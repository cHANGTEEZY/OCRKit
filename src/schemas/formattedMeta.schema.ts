import { z } from "zod";

export const structuredMetaSchema = z.object({
  missingFields: z.array(z.string()),
  warnings: z.array(z.string()),
  unsupportedRequestedFields: z.array(z.string()),
  ignoredInputFields: z.array(z.string()),
  needsReview: z.boolean(),
});

export type StructuredMeta = z.infer<typeof structuredMetaSchema>;

export const formattedEnvelopeSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  meta: structuredMetaSchema,
});

export type FormattedEnvelope = z.infer<typeof formattedEnvelopeSchema>;
