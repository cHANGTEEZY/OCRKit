import { z } from "zod";
import type { DocumentType, ResponseProfile } from "./document.enums.js";
import {
  paymentReceiptFullDataSchema,
  paymentReceiptFullRequiredKeys,
  paymentReceiptSummaryDataSchema,
  paymentReceiptSummaryRequiredKeys,
} from "./paymentReceipt.schemas.js";

export type DocumentVariantKey = `${DocumentType}:${ResponseProfile}`;

export type DataSchemaEntry = {
  schema: z.ZodObject<z.ZodRawShape>;
  requiredKeys: readonly string[];
};

const registry: Partial<Record<DocumentVariantKey, DataSchemaEntry>> = {
  "payment_receipt:summary": {
    schema: paymentReceiptSummaryDataSchema,
    requiredKeys: paymentReceiptSummaryRequiredKeys,
  },
  "payment_receipt:full": {
    schema: paymentReceiptFullDataSchema,
    requiredKeys: paymentReceiptFullRequiredKeys,
  },
};

export function getSchemaEntry(
  documentType: DocumentType,
  responseProfile: ResponseProfile,
): DataSchemaEntry {
  const key = `${documentType}:${responseProfile}` as DocumentVariantKey;
  const entry = registry[key];
  if (!entry) {
    throw new UnsupportedDocumentVariantError(documentType, responseProfile);
  }
  return entry;
}

export class UnsupportedDocumentVariantError extends Error {
  readonly code = "UNSUPPORTED_DOCUMENT_VARIANT";

  constructor(
    public readonly documentType: DocumentType,
    public readonly responseProfile: ResponseProfile,
  ) {
    super(
      `No schema registered for documentType=${documentType} profile=${responseProfile}`,
    );
    this.name = "UnsupportedDocumentVariantError";
  }
}

export function getAllowedTopLevelKeys(entry: DataSchemaEntry): string[] {
  return Object.keys(entry.schema.shape);
}
