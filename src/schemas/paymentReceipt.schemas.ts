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

const receiptLineItemSchema = z.object({
  itemName: z.string().nullable(),
  price: nullableMoney,
});

/** payment_receipt / summary — venue name + line items */
export const paymentReceiptSummaryDataSchema = z.object({
  title: z.string().nullable(),
  items: z.array(receiptLineItemSchema).default([]),
});

export type PaymentReceiptSummaryData = z.infer<
  typeof paymentReceiptSummaryDataSchema
>;

/** payment_receipt / full — same core plus optional receipt metadata */
export const paymentReceiptFullDataSchema =
  paymentReceiptSummaryDataSchema.extend({
    totalAmount: nullableMoney,
    receiptDate: z.string().nullable(),
    currency: z.string().nullable(),
    transactionId: z.string().nullable(),
  });

export type PaymentReceiptFullData = z.infer<
  typeof paymentReceiptFullDataSchema
>;

export const paymentReceiptSummaryRequiredKeys = ["title"] as const;

export const paymentReceiptFullRequiredKeys = ["title"] as const;
