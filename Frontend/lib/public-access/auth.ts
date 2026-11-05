import "server-only";
import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { publicAccessSql } from "./db";
import { sendPublicMail } from "./mail";

export const PUBLIC_SESSION_COOKIE = "kravia_public_session";
export const CONSENT_VERSION = "2026-11-05";
export const PUBLIC_SESSION_SECONDS = 30 * 24 * 60 * 60;
export class PublicAccessError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
function secret() {
  const base = process.env.KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET?.trim();
  if (!base || base.length < 32) throw new PublicAccessError(503, "Public identity is not configured.");
  return createHmac("sha256", base).update("kravia-public-access-identity-v1").digest();
}
function digest(purpose: string, value: string) {
  return createHmac("sha256", secret()).update(`${purpose}:${value}`, "utf8").digest("hex");
}
export function safePublicReturnPath(input: string | undefined | null): string {
  if (typeof input !== "string" || input.length > 240 || !input.startsWith("/") ||
      input.startsWith("//") || input.includes("\\") || /[\u0000-\u001f]/.test(input)) return "/resources";
  if (input === "/resources" || input === "/account") return input;
  return /^\/api\/public-resources\/[a-z0-9][a-z0-9-]{2,79}\/download$/.test(input) ? input : "/resources";
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const defaultName = (email: string) => { const local = email.split("@")[0]!.trim(); return local.length >= 2 ? local.slice(0,80) : "Visitor"; };
export async function startAccess(input: {
  email: string; displayName?: string; marketing: boolean; returnPath: string; quotaIdentity: string;
}) {
  const email = input.email.trim().toLowerCase();
  const displayName = (input.displayName?.trim() || defaultName(email)).slice(0, 120);
  if (!emailPattern.test(email) || email.length > 254 || displayName.length < 2) {
    throw new PublicAccessError(400, "Enter a valid email address and name.");
  }
  const id = randomUUID();
  const code = String(randomInt(100000, 1000000));
  const sql = publicAccessSql();
  // Apply an independent source-level limit as well as the per-email quota.
  const ipRows = await sql`insert into public_access.request_windows as rate_window
    (fingerprint,window_started,request_count)
    values(${digest("ip",input.quotaIdentity)},now(),1)
    on conflict(fingerprint) do update
    set window_started=case when rate_window.window_started<now()-interval '15 minutes'
      then now() else rate_window.window_started end,
    request_count=case when rate_window.window_started<now()-interval '15 minutes'
      then 1 else rate_window.request_count+1 end
    where rate_window.window_started<now()-interval '15 minutes' or rate_window.request_count<20
    returning request_count`;
  if (!ipRows.length) throw new PublicAccessError(429,"Verification requests are temporarily limited.");
  const rows = await sql`select public_access.reserve_challenge(
    ${id}::uuid, ${email}, ${displayName},
    ${digest("code", `${id}:${email}:${code}`)},
    ${input.marketing}, ${safePublicReturnPath(input.returnPath)},
    ${digest("rate", `${input.quotaIdentity}:${email}`)}
  ) as accepted`;
  if (rows[0]?.accepted !== true) throw new PublicAccessError(429, "Too many verification requests. Try again later.");
  try {
    await sendPublicMail({
      kind: "ACCOUNT_CODE", event_id: `public-code:${id}`,
      recipient_email: email, recipient_name: displayName, code,
    });
  } catch {
    await sql`update public_access.email_challenges set consumed_at=now()
      where id=${id}::uuid and consumed_at is null`.catch(() => undefined);
    throw new PublicAccessError(503, "Email verification is temporarily unavailable.");
  }
  return id;
}
type CompleteResult = {
  account_id:string; email:string; display_name:string;
  new_account:boolean; newsletter_pending:boolean;
};
export async function completeAccess(challengeId:string, code:string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    throw new PublicAccessError(400, "Invalid verification code.");
  }
  const sql=publicAccessSql();
  const challenge=await sql`select email from public_access.email_challenges
    where id=${challengeId}::uuid and consumed_at is null and expires_at>now()`;
  if (!challenge[0]?.email) throw new PublicAccessError(400, "The code is invalid or expired.");
  const email=String(challenge[0].email);
  const token=randomBytes(32).toString("base64url");
  const confirmToken=randomBytes(32).toString("base64url");
  const unsubscribeToken=randomBytes(32).toString("base64url");
  const rows=await sql`select * from public_access.complete_challenge(
    ${challengeId}::uuid, ${digest("code", `${challengeId}:${email}:${code}`)},
    ${digest("session",token)}, ${digest("newsletter-confirm",confirmToken)},
    ${digest("newsletter-unsubscribe",unsubscribeToken)}, ${CONSENT_VERSION}
  )`;
  const result=rows[0] as CompleteResult|undefined;
  if (!result) throw new PublicAccessError(400, "The code is invalid, expired or already used.");
  if (result.new_account) {
    await sendPublicMail({kind:"ACCOUNT_WELCOME",event_id:`public-welcome:${result.account_id}`,
      recipient_email:result.email,recipient_name:result.display_name}).catch(() => undefined);
  }
  if (result.newsletter_pending) {
    await sendPublicMail({kind:"NEWSLETTER_CONFIRM",event_id:`public-newsletter-confirm:${challengeId}`,
      recipient_email:result.email,recipient_name:result.display_name,
      action_url:`https://www.kraviaprivatelimited.com/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`
    }).catch(() => undefined);
  }
  return {...result,token};
}
export type PublicAccount={id:string;email:string;displayName:string;newsletterStatus:string};
export async function currentPublicAccount():Promise<PublicAccount|null> {
  const token=(await cookies()).get(PUBLIC_SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  try {
    const sql=publicAccessSql();
    const rows=await sql`select a.id,a.email,a.display_name,coalesce(n.status,'NONE') as newsletter_status
      from public_access.sessions s join public_access.accounts a on a.id=s.account_id
      left join public_access.newsletters n on n.account_id=a.id
      where s.token_hash=${digest("session",token)} and s.expires_at>now()
        and s.revoked_at is null and a.status='ACTIVE' limit 1`;
    const row=rows[0];
    return row ? {id:String(row.id),email:String(row.email),displayName:String(row.display_name),
      newsletterStatus:String(row.newsletter_status)} : null;
  } catch { return null; }
}
export async function revokePublicSession() {
  const token=(await cookies()).get(PUBLIC_SESSION_COOKIE)?.value;
  if (!token) return;
  const sql=publicAccessSql();
  await sql`update public_access.sessions set revoked_at=now()
    where token_hash=${digest("session",token)} and revoked_at is null`;
}
export function tokenDigest(kind:"newsletter-confirm"|"newsletter-unsubscribe",token:string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new PublicAccessError(400, "Invalid action token.");
  return digest(kind,token);
}
export function issueNewsletterToken() {
  const token=randomBytes(32).toString("base64url");
  return {token,hash:digest("newsletter-confirm",token)};
}
export function issueUnsubscribeToken() {
  const token=randomBytes(32).toString("base64url");
  return {token,hash:digest("newsletter-unsubscribe",token)};
}
