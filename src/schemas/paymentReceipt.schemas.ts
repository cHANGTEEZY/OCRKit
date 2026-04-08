import { z } from "zod";

const nullableMoney = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]/g, "");
    if (cleaned === "") return null;
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

/** payment_receipt / summary */
export const paymentReceiptSummaryDataSchema = z.object({
  merchantName: z.string().nullable(),
  totalAmount: nullableMoney,
  receiptDate: z.string().nullable(),
  currency: z.string().nullable(),
});

export type PaymentReceiptSummaryData = z.infer<
  typeof paymentReceiptSummaryDataSchema
>;

/** payment_receipt / full */
export const paymentReceiptFullDataSchema =
  paymentReceiptSummaryDataSchema.extend({
    transactionId: z.string().nullable(),
    lineItems: z
      .array(
        z.object({
          description: z.string().nullable(),
          amount: nullableMoney,
        }),
      )
      .default([]),
  });

export type PaymentReceiptFullData = z.infer<
  typeof paymentReceiptFullDataSchema
>;

export const paymentReceiptSummaryRequiredKeys = [
  "merchantName",
  "totalAmount",
  "receiptDate",
] as const;

export const paymentReceiptFullRequiredKeys = [
  ...paymentReceiptSummaryRequiredKeys,
  "transactionId",
] as const;
