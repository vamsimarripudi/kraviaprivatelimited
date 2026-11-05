import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Stateless per-account opt-out tokens remain valid across marketing issues. */
function mac(id: string): Buffer {
  const root=process.env.KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET?.trim();
  if(!root||root.length<32)throw new Error("Newsletter signing key is unavailable.");
  const signingKey=createHmac("sha256",root).update("kravia-newsletter-unsubscribe-v1").digest();
  return createHmac("sha256",signingKey).update(id,"ascii").digest();
}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function makeCampaignUnsubscribeToken(accountId: string): string {
  if(!UUID_RE.test(accountId))throw new Error("Invalid account identifier");
  const compact=accountId.replaceAll("-","");
  return compact+mac(compact).toString("base64url");
}
export function verifyCampaignUnsubscribeToken(token: string): string|null {
  if(!/^[0-9a-f]{32}[A-Za-z0-9_-]{43}$/.test(token))return null;
  const compact=token.slice(0,32);
  const supplied=Buffer.from(token.slice(32),"base64url");
  const expected=mac(compact);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
  return compact.slice(0,8)+"-"+compact.slice(8,12)+"-"+compact.slice(12,16)+"-"+compact.slice(16,20)+"-"+compact.slice(20);
}
