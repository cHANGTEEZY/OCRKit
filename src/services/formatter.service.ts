import { env, type FormatterMode } from "../config/env.js";
import { buildFormatterSystemPrompt } from "../prompts/formatterPrompt.js";
import { getAllowedTopLevelKeys, getSchemaEntry } from "../schemas/documentRegistry.js";
import type { DocumentType, ResponseProfile } from "../schemas/document.enums.js";
import type { StructuredMeta } from "../schemas/formattedMeta.schema.js";
import { parseJsonObject } from "../utils/jsonExtract.js";
import { heuristicPaymentReceiptFromText } from "../utils/paymentReceiptHeuristic.js";

export type FormatDocumentInput = {
  rawText: string;
  confidence?: number;
  documentType: DocumentType;
  responseProfile: ResponseProfile;
  strictMode: boolean;
  clientRequestedFields?: string[];
};

export class FormatterError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FORMATTER_LLM_FAILED"
      | "FORMATTER_INVALID_JSON"
      | "FORMATTER_CONFIG",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "FormatterError";
  }
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;

const KEY_TYPES_HINT: Record<string, string> = {
  "payment_receipt:summary":
    "title: string|null (restaurant, theater, merchant header), items: [{ itemName: string|null, price: number|null }] — one object per purchased line when visible",
  "payment_receipt:full":
    "same title + items plus totalAmount: number|null, receiptDate: string|null (ISO yyyy-mm-dd if possible), currency: string|null (ISO 4217), transactionId: string|null",
};

function normalizeDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? null : t;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDeep(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeDeep(v);
    }
    return out;
  }
  return value;
}

function pickAllowedKeys(
  raw: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      out[key] = raw[key];
    }
  }
  return out;
}

function isRequiredValueMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function computeMissingRequiredFields(
  data: Record<string, unknown>,
  requiredKeys: readonly string[],
): string[] {
  const missing: string[] = [];
  for (const key of requiredKeys) {
    if (isRequiredValueMissing(data[key])) missing.push(key);
  }
  return missing;
}

function buildStubData(allowedKeys: string[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of allowedKeys) {
    o[k] = k === "items" || k === "lineItems" ? [] : null;
  }
  return o;
}

function applyClientFieldFilter(
  data: Record<string, unknown>,
  clientRequested: string[] | undefined,
  allowedKeys: string[],
): Record<string, unknown> {
  if (!clientRequested?.length) {
    return { ...data };
  }
  const allowed = new Set(allowedKeys);
  const requestedAllowed = clientRequested.filter((k) => allowed.has(k));
  const out: Record<string, unknown> = {};
  for (const key of requestedAllowed) {
    out[key] = Object.prototype.hasOwnProperty.call(data, key)
      ? data[key]
      : null;
  }
  return out;
}

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

async function callOpenAiFormatter(args: {
  system: string;
  userJson: string;
}): Promise<string> {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new FormatterError(
      "OPENAI_API_KEY is required when FORMATTER_MODE=openai",
      "FORMATTER_CONFIG",
    );
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.userJson },
      ],
    }),
  });
  const payload = (await res.json()) as OpenAIChatResponse;
  if (!res.ok) {
    throw new FormatterError(
      payload.error?.message ?? `OpenAI error HTTP ${res.status}`,
      "FORMATTER_LLM_FAILED",
    );
  }
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new FormatterError("Empty model response", "FORMATTER_LLM_FAILED");
  }
  return content;
}

async function runLlmOnce(
  input: FormatDocumentInput,
  allowedKeys: string[],
  documentType: DocumentType,
  responseProfile: ResponseProfile,
): Promise<Record<string, unknown>> {
  const variantKey = `${documentType}:${responseProfile}`;
  const keyTypesHint =
    KEY_TYPES_HINT[variantKey] ??
    allowedKeys.map((k) => `${k}: unknown`).join(", ");
  const system = buildFormatterSystemPrompt({
    documentType,
    responseProfile,
    allowedKeys,
    keyTypesHint,
  });
  const userPayload = {
    sourceData: {
      rawText: input.rawText,
      confidence: input.confidence ?? null,
    },
    documentType: input.documentType,
    responseProfile: input.responseProfile,
    strictMode: input.strictMode,
    clientRequestedFields: input.clientRequestedFields ?? null,
  };
  const raw = await callOpenAiFormatter({
    system,
    userJson: JSON.stringify(userPayload),
  });
  try {
    return parseJsonObject(raw);
  } catch (firstError) {
    const retryRaw = await callOpenAiFormatter({
      system:
        system +
        "\nYour previous output was invalid JSON. Respond with one raw JSON object only.",
      userJson: JSON.stringify(userPayload),
    });
    try {
      return parseJsonObject(retryRaw);
    } catch {
      throw new FormatterError(
        "Model returned non-JSON output",
        "FORMATTER_INVALID_JSON",
        { cause: firstError },
      );
    }
  }
}

export async function formatDocumentSource(
  input: FormatDocumentInput,
): Promise<{ data: Record<string, unknown>; meta: StructuredMeta }> {
  const entry = getSchemaEntry(input.documentType, input.responseProfile);

  const allowedKeys = getAllowedTopLevelKeys(entry);
  const allowedSet = new Set(allowedKeys);
  const requested = input.clientRequestedFields ?? [];
  const unsupportedRequestedFields = requested.filter((k) => !allowedSet.has(k));

  const warnings: string[] = [];
  if (
    input.confidence !== undefined &&
    input.confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    warnings.push(
      `OCR confidence ${input.confidence.toFixed(2)} is below ${LOW_CONFIDENCE_THRESHOLD}`,
    );
  }

  const mode: FormatterMode = env.formatterMode;
  let rawData: Record<string, unknown>;

  if (mode === "stub") {
    if (input.documentType === "payment_receipt") {
      rawData = heuristicPaymentReceiptFromText(
        input.rawText,
        input.responseProfile,
        allowedKeys,
      );
      warnings.push(
        "Stub mode: payment_receipt uses built-in text heuristics; set FORMATTER_MODE=openai for LLM extraction.",
      );
    } else {
      rawData = buildStubData(allowedKeys);
      warnings.push(
        "Formatter ran in stub mode (FORMATTER_MODE=stub); structured fields were not inferred from text.",
      );
    }
  } else {
    if (!env.openaiApiKey) {
      throw new FormatterError(
        "FORMATTER_MODE=openai requires OPENAI_API_KEY",
        "FORMATTER_CONFIG",
      );
    }
    const parsed = await runLlmOnce(
      input,
      allowedKeys,
      input.documentType,
      input.responseProfile,
    );
    rawData = pickAllowedKeys(parsed, allowedSet);
  }

  const normalized = normalizeDeep(rawData) as Record<string, unknown>;
  let parsed = entry.schema.safeParse(normalized);
  if (!parsed.success) {
    const salvage = normalizeDeep(
      pickAllowedKeys(normalized as Record<string, unknown>, allowedSet),
    ) as Record<string, unknown>;
    parsed = entry.schema.safeParse(salvage);
  }
  let dataValidated: Record<string, unknown>;
  if (parsed.success) {
    dataValidated = parsed.data as Record<string, unknown>;
  } else {
    dataValidated = buildStubData(allowedKeys);
    warnings.push(
      `Schema validation failed; returned safe defaults: ${parsed.error.issues.map((i) => i.path.join(".") || "root").join(", ")}`,
    );
  }

  const missingFields = computeMissingRequiredFields(
    dataValidated,
    entry.requiredKeys,
  );

  const needsReview = input.strictMode && missingFields.length > 0;

  const dataFiltered = applyClientFieldFilter(
    dataValidated,
    input.clientRequestedFields,
    allowedKeys,
  );

  const meta: StructuredMeta = {
    missingFields,
    warnings,
    unsupportedRequestedFields,
    ignoredInputFields: [],
    needsReview,
  };

  return { data: dataFiltered, meta };
}
