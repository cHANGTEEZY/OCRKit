import {
  documentTypeSchema,
  responseProfileSchema,
} from "../schemas/document.enums.js";
import type { DocumentType, ResponseProfile } from "../schemas/document.enums.js";

export type ParsedFormatOptions = {
  wantsFormat: boolean;
  documentType?: DocumentType;
  responseProfile: ResponseProfile;
  strictMode: boolean;
  clientRequestedFields?: string[];
};

function parseBooleanLoose(value: unknown, defaultValue: boolean): boolean {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  if (value === undefined || value === null || value === "") return defaultValue;
  return defaultValue;
}

function parseStringArrayField(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return undefined;
}

export function parseFormatOptions(body: Record<string, unknown> | undefined): {
  ok: true;
  value: ParsedFormatOptions;
} | {
  ok: false;
  code: string;
  message: string;
} {
  if (!body || typeof body !== "object") {
    return {
      ok: true,
      value: {
        wantsFormat: false,
        responseProfile: "full",
        strictMode: false,
      },
    };
  }

  const formatFlag = parseBooleanLoose(body.format, false);
  const docRaw = body.documentType;
  const hasDocumentType =
    typeof docRaw === "string" && docRaw.trim().length > 0;

  const wantsFormat = formatFlag || hasDocumentType;

  if (!wantsFormat) {
    return {
      ok: true,
      value: {
        wantsFormat: false,
        responseProfile: "full",
        strictMode: false,
      },
    };
  }

  if (!hasDocumentType) {
    return {
      ok: false,
      code: "MISSING_DOCUMENT_TYPE",
      message:
        "When format is requested, documentType is required (e.g. payment_receipt)",
    };
  }

  const dt = documentTypeSchema.safeParse(docRaw);
  if (!dt.success) {
    return {
      ok: false,
      code: "INVALID_DOCUMENT_TYPE",
      message: "documentType must be one of payment_receipt | invoice | resume",
    };
  }

  const profileRaw = body.responseProfile ?? "full";
  const profile = responseProfileSchema.safeParse(profileRaw);
  if (!profile.success) {
    return {
      ok: false,
      code: "INVALID_RESPONSE_PROFILE",
      message: "responseProfile must be summary or full",
    };
  }

  const value: ParsedFormatOptions = {
    wantsFormat: true,
    documentType: dt.data,
    responseProfile: profile.data,
    strictMode: parseBooleanLoose(body.strictMode, false),
  };
  const clientFields = parseStringArrayField(body.clientRequestedFields);
  if (clientFields !== undefined) {
    value.clientRequestedFields = clientFields;
  }
  return { ok: true, value };
}
