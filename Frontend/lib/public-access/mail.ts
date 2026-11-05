import "server-only";
import { createHmac } from "node:crypto";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";

export type PublicMailKind = "ACCOUNT_CODE" | "ACCOUNT_WELCOME" | "NEWSLETTER_CONFIRM" |
  "NEWSLETTER_WELCOME" | "NEWSLETTER_UNSUBSCRIBED" | "DOWNLOAD_RECEIPT" | "ACCOUNT_SECURITY";
export type PublicMailRequest = {
  kind: PublicMailKind;
  event_id: string;
  recipient_email: string;
  recipient_name: string;
  code?: string;
  action_url?: string;
  resource_title?: string;
};
export async function sendPublicMail(mail: PublicMailRequest): Promise<void> {
  const secret = process.env.KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET?.trim();
  const origin = getOfficeRuntimeOrigin();
  if (!secret || secret.length < 32 || !origin) throw new Error("KRAVIA verified mail transport is not configured.");
  const body = JSON.stringify(mail);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`public-access-v1.${timestamp}.${body}`, "utf8").digest("hex");
  const response = await fetch(new URL("/api/v1/public-access/email", origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kravia-public-timestamp": timestamp,
      "x-kravia-public-signature": `v1=${signature}`,
    },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("KRAVIA could not confirm email submission.");
}
