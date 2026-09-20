import { z } from "zod";

export const webhookSchema = z.object({
  eventId: z.string().min(6).max(120),
  provider: z.enum(["mobimoney", "orange-pay", "pesa-link"]),
  externalReference: z.string().min(6).max(120),
  merchantReference: z.string().min(4).max(120),
  amountMinor: z.number().int().positive(),
  currency: z.enum(["XAF", "XOF", "KES", "GHS", "NGN"]),
  status: z.enum(["initiated", "processing", "successful", "failed", "reversed"]),
  customerLabel: z.string().min(2).max(160),
  occurredAt: z.iso.datetime(),
});

export const simulationSchema = z.object({
  scenario: z.enum(["missing_ledger", "amount_mismatch", "duplicate_webhook"]),
});
