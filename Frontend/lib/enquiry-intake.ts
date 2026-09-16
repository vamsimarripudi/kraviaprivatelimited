import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const enquiryInput = z.object({ requestId: z.uuid().optional(), name: z.string().trim().min(2).max(120), email: z.email().max(254), category: z.string().trim().min(1).max(100), organisation: z.string().trim().max(160).optional(), message: z.string().trim().min(10).max(4000), privacyAcknowledged: z.literal("true") });
export function enquiryReference(input: z.infer<typeof enquiryInput>) {
  const { requestId, ...fields } = input;
  return `KRV-${createHash("sha256").update(JSON.stringify([requestId ?? randomUUID(), fields])).digest("hex").slice(0, 24).toUpperCase()}`;
}
export function enquiryFingerprint(address: string) {
  return createHash("sha256").update(`corporate-enquiry:${address}`).digest("hex");
}
