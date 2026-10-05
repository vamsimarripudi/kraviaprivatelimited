import { createHmac } from "node:crypto";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";

// This Node crypto dependency and the server-only Office runtime configuration
// intentionally keep this module usable only from Route Handlers or other
// trusted server code. It must never be imported by a Client Component.

export type PublicFormKind = "CONTACT" | "SUPPORT" | "TRUST_REQUEST";

type PublicFormReceipt = {
  eventId: string;
  formKind: PublicFormKind;
  reference: string;
  recipientEmail: string;
  recipientName: string;
};

type PublicFormFollowUp = PublicFormReceipt & {
  message: string;
};

type ReceiptConfiguration = { origin: string; secret: string };

function receiptConfiguration(): ReceiptConfiguration | null {
  const origin = getOfficeRuntimeOrigin();
  const secret = process.env.KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET?.trim();
  if (!origin || !secret || secret.length < 32) return null;
  return { origin, secret };
}

/**
 * Send a server-to-server acknowledgement request after the public form has
 * already been persisted. The helper deliberately returns a neutral state:
 * the public UI never claims that email was sent when the provider is absent,
 * rejected the request, or produced an unknown result.
 */
export async function requestPublicFormReceipt(receipt: PublicFormReceipt): Promise<"sent" | "unavailable" | "failed"> {
  const configuration = receiptConfiguration();
  if (!configuration) return "unavailable";

  const body = JSON.stringify({
    event_id: receipt.eventId,
    form_kind: receipt.formKind,
    reference: receipt.reference,
    recipient_email: receipt.recipientEmail,
    recipient_name: receipt.recipientName,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", configuration.secret).update(`${timestamp}.${body}`, "utf8").digest("hex");

  try {
    const response = await fetch(new URL("/api/v1/public-intake/email-acknowledgements", configuration.origin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kravia-intake-timestamp": timestamp,
        "x-kravia-intake-signature": `v1=${signature}`,
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Deliver one Office-authored reply after the public request update has been
 * persisted. The caller must treat `unknown` as terminal until the delivery
 * provider is reconciled; retrying an uncertain email risks duplicates.
 */
export async function requestPublicFormFollowUp(reply: PublicFormFollowUp): Promise<"sent" | "failed" | "unknown"> {
  const configuration = receiptConfiguration();
  if (!configuration) return "failed";
  const body = JSON.stringify({
    event_id: reply.eventId,
    form_kind: reply.formKind,
    reference: reply.reference,
    recipient_email: reply.recipientEmail,
    recipient_name: reply.recipientName,
    message: reply.message,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", configuration.secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  try {
    const response = await fetch(new URL("/api/v1/public-intake/email-follow-ups", configuration.origin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kravia-intake-timestamp": timestamp,
        "x-kravia-intake-signature": `v1=${signature}`,
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return "sent";
    return response.headers.get("x-kravia-delivery-status") === "UNKNOWN" ? "unknown" : "failed";
  } catch {
    return "unknown";
  }
}
