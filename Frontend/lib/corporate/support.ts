export type SupportCaseStatus = "NEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED" | "CLOSED";
export type SupportCasePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SupportCaseQueue = "GENERAL" | "TRUST_DPDPA" | "SECURITY_REPORTING";

export const supportStatuses = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"] as const satisfies readonly SupportCaseStatus[];
export const supportPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const satisfies readonly SupportCasePriority[];
export const supportQueues = ["GENERAL", "TRUST_DPDPA", "SECURITY_REPORTING"] as const satisfies readonly SupportCaseQueue[];
export const supportQueueLabels: Record<SupportCaseQueue, string> = { GENERAL: "General support", TRUST_DPDPA: "Trust & DPDP", SECURITY_REPORTING: "Security reporting" };

export function createSupportReference() { return `KRV-SUP-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`; }
export async function hashTrackingCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function createTrackingCode() { return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase(); }