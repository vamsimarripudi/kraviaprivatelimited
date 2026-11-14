import "server-only";

const endpoint = "https://api.brevo.com/v3/smtp/email";
const sender = "hello@kraviaprivatelimited.com";

export class DocumentOtpMailUnavailable extends Error {}
export class DocumentOtpMailRejected extends Error {}
export class DocumentOtpMailUnknown extends Error {}

function escaped(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function documentOtpMailReady() {
  return Boolean(process.env.BREVO_API_KEY?.trim()) &&
    (!process.env.BREVO_SENDER_EMAIL ||
      process.env.BREVO_SENDER_EMAIL.trim().toLowerCase() === sender);
}

/** Only the signer selected by an AAL2 Office session may receive this OTP.
 * Do not reuse a sign-in challenge, export the code to the browser or retry
 * a provider-unknown send. */
export async function sendOfficeDocumentApprovalCode(args: {
  recipientEmail: string;
  recipientName: string;
  documentCode: string;
  code: string;
  challengeId: string;
}): Promise<string | null> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey || !documentOtpMailReady())
    throw new DocumentOtpMailUnavailable("Document approval mail is not configured");
  if (!/^\d{6}$/.test(args.code) ||
    !/^[A-Z0-9-]{3,80}$/.test(args.documentCode) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.recipientEmail) ||
    !/^[0-9a-f-]{36}$/.test(args.challengeId)) {
    throw new DocumentOtpMailRejected("Invalid document approval recipient or challenge");
  }
  const name = escaped(args.recipientName.slice(0, 160));
  const code = escaped(args.code);
  const documentCode = escaped(args.documentCode);
  const subject = "KRAVIA Office document approval code — " + args.documentCode;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f5f7f6;font-family:Arial,sans-serif;color:#14241d">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background:#fff;border:1px solid #dce8df;border-radius:12px">
<tr><td style="padding:22px 26px;border-bottom:1px solid #e2e9e4;font-weight:bold;font-size:14px">KRAVIA PRIVATE LIMITED · OFFICE</td></tr>
<tr><td style="padding:26px"><h1 style="font-size:22px;margin:0 0 16px">Confirm document approval</h1>
<p style="font-size:14px;line-height:1.5">Hello ${name}, use this one-time code to approve document <strong>${documentCode}</strong> in your authenticated Office session.</p>
<p style="font-size:31px;letter-spacing:8px;font-weight:bold;padding:16px;background:#edf6f0;border-radius:10px;text-align:center">${code}</p>
<p style="font-size:13px">This code expires in 7 minutes. Do not share it. We will never ask you to relay the code.</p>
<p style="font-size:12px;color:#59675f">This confirms an internal OTP approval; it is not a licensed certificate-based digital signature. Location permission and employee identity verification are required in Office.</p></td></tr>
<tr><td style="padding:16px 26px;border-top:1px solid #e2e9e4;color:#68736d;font-size:11px">KRAVIA Office · Private document workflow</td></tr>
</table></td></tr></table></body></html>`;
  const textContent = [
    "KRAVIA Office — internal document approval",
    "Hello " + args.recipientName + ",",
    "Document: " + args.documentCode,
    "One-time code: " + args.code,
    "Expires in 7 minutes. Never share this code.",
    "This is an internal OTP approval, not a certificate-based digital signature.",
  ].join("\n");
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST", cache: "no-store", redirect: "manual",
      headers: { "accept": "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: "KRAVIA Office", email: sender },
        to: [{ email: args.recipientEmail }],
        subject, htmlContent: html, textContent,
        tags: ["kravia-office", "document-approval-otp"],
        headers: { "Idempotency-Key": "kravia-doc-otp:" + args.challengeId },
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new DocumentOtpMailUnknown("Provider acceptance could not be verified");
  }
  if (response.status === 201) {
    const payload = await response.json().catch(() => ({})) as { messageId?: unknown };
    return typeof payload.messageId === "string" ? payload.messageId.slice(0, 320) : null;
  }
  if (response.status >= 400 && response.status < 500) {
    throw new DocumentOtpMailRejected("Provider rejected the approval OTP");
  }
  throw new DocumentOtpMailUnknown("Provider acceptance could not be verified");
}
