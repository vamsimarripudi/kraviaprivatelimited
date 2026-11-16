import "server-only";
import { publicCorporateEmails } from "@/lib/corporate/public-email-directory";
export type CareerNoticeKind = "EMAIL_VERIFICATION" | "APPLICATION_RECEIPT" | "ACCESS_LINK" | "WITHDRAWAL_RECEIPT" | "OFFER_ACKNOWLEDGEMENT";
export type CareerMailResult = { outcome: "SENT" | "FAILED" | "UNKNOWN"; providerId?: string; category?: string };
const origin = "https://kraviaprivatelimited.com";
export function careerMailConfigured(): boolean {
  const key = process.env.KRAVIA_CAREERS_BREVO_API_KEY || process.env.BREVO_API_KEY;
  return Boolean(key?.trim() && key.trim().length >= 16);
}
function escape(value: string): string {
  return value.replace(/[&<>"']/g, letter => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[letter] || letter));
}
export function careerNotice(kind: CareerNoticeKind, name: string, reference: string, token?: string) {
  const safeName = escape(name.slice(0, 120));
  const safeReference = escape(reference.slice(0, 50));
  const link = token ? new URL("/careers/application/verify", origin) : null;
  if (link && token) link.searchParams.set("token", token);
  const urls = link?.toString();
  const subjects: Record<CareerNoticeKind, string> = {
    EMAIL_VERIFICATION: "Verify your KRAVIA Careers application",
    APPLICATION_RECEIPT: "KRAVIA Careers - Application received",
    ACCESS_LINK: "Access your KRAVIA Careers application",
    WITHDRAWAL_RECEIPT: "KRAVIA Careers - Withdrawal recorded",
    OFFER_ACKNOWLEDGEMENT: "KRAVIA Careers - Your offer response was recorded",
  };
  let message: string;
  switch(kind) {
    case "EMAIL_VERIFICATION":
      message = "Confirm that you submitted an application. This link expires in 30 minutes. Do not forward it.";
      break;
    case "ACCESS_LINK":
      message = "Use this link to securely access your existing application. It expires in 30 minutes. Do not forward it.";
      break;
    case "APPLICATION_RECEIPT":
      message = "Your verified application is now in our recruitment queue. We will communicate hiring decisions through authorized channels.";
      break;
    case "WITHDRAWAL_RECEIPT":
      message = "Your withdrawal request is recorded. If you were already in HR review, the recruitment team will finalize closure.";
      break;
    case "OFFER_ACKNOWLEDGEMENT":
      message = "Your offer response has been captured. It remains subject to independent HR verification and the signed offer process. No employee account has been created.";
      break;
  }
  const body = "Hello " + name + ",\n\n" + message + "\n\nApplication: " + reference +
    (urls ? "\n\nSecure link: " + urls : "") +
    "\n\nIf you did not request this, ignore the message. Never send passwords, bank details or identity documents by email.\n\nKRAVIA PRIVATE LIMITED\nRecruitment team";
  const html = [
    '<div style="font:15px/1.65 Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#172541">',
    '<p style="font-size:12px;letter-spacing:2px;font-weight:700;color:#4d5c89">KRAVIA PRIVATE LIMITED</p>',
    '<h1 style="font-size:24px;line-height:1.2">' + escape(subjects[kind]) + '</h1>',
    '<p>Hello ' + safeName + ',</p><p>' + escape(message) + '</p>',
    '<p><strong>Application reference:</strong> ' + safeReference + '</p>',
    urls ? '<p><a href="' + escape(urls) + '" style="background:#223a6a;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px">Access securely</a></p>' : "",
    '<p style="font-size:12px;color:#607088">This is a transactional hiring notice, not a marketing message. Do not share credentials or documents by email.</p>',
    '</div>'
  ].join("");
  return { subject: subjects[kind], text: body, html };
}
export async function sendCareerNotice(input: {
  kind: CareerNoticeKind; name: string; email: string; reference: string; token?: string;
}): Promise<CareerMailResult> {
  const key = process.env.KRAVIA_CAREERS_BREVO_API_KEY || process.env.BREVO_API_KEY;
  if (!key || key.length < 16) return { outcome: "FAILED", category: "MAIL_NOT_CONFIGURED" };
  const payload = careerNotice(input.kind, input.name, input.reference, input.token);
  const from = process.env.KRAVIA_CAREERS_FROM_EMAIL?.trim() || publicCorporateEmails.careers;
  if (!from.endsWith("@kraviaprivatelimited.com")) return { outcome: "FAILED", category: "SENDER_NOT_AUTHORIZED" };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "KRAVIA Careers", email: from },
        to: [{ email: input.email, name: input.name }],
        replyTo: { email: publicCorporateEmails.careers },
        subject: payload.subject, textContent: payload.text, htmlContent: payload.html,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { outcome: response.status >= 500 || response.status === 429 ? "UNKNOWN" : "FAILED", category: "PROVIDER_REJECTED" };
    const value = await response.json().catch(() => null) as { messageId?: string } | null;
    return { outcome: "SENT", providerId: value?.messageId };
  } catch {
    return { outcome: "UNKNOWN", category: "PROVIDER_UNCERTAIN" };
  }
}
