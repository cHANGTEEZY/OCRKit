import { z } from "zod";

export const documentTypeSchema = z.enum([
  "payment_receipt",
  "invoice",
  "resume",
]);

export type DocumentType = z.infer<typeof documentTypeSchema>;

export const responseProfileSchema = z.enum(["summary", "full"]);

export type ResponseProfile = z.infer<typeof responseProfileSchema>;
