import { normalizeBase32 } from "./base32";
import { KRAVIA_ISSUER, type KraviaTotpAccount } from "./types";

const CORPORATE_ACCOUNT = /^[^\s@]+@kraviaprivatelimited\.com$/;

export function validateStoredAccount(value: unknown): KraviaTotpAccount | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Partial<KraviaTotpAccount>;
  const normalizedSecret = typeof account.secret === "string" ? normalizeBase32(account.secret) : "";
  const enrolledAt = typeof account.enrolledAt === "string" ? Date.parse(account.enrolledAt) : Number.NaN;

  if (
    account.version !== 1
    || account.issuer !== KRAVIA_ISSUER
    || typeof account.account !== "string"
    || !CORPORATE_ACCOUNT.test(account.account.trim().toLowerCase())
    || normalizedSecret.length < 16
    || !/^[A-Z2-7]+$/.test(normalizedSecret)
    || account.algorithm !== "SHA1"
    || account.digits !== 6
    || account.period !== 30
    || !Number.isFinite(enrolledAt)
  ) {
    return null;
  }

  return {
    version: 1,
    issuer: KRAVIA_ISSUER,
    account: account.account.trim().toLowerCase(),
    secret: normalizedSecret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    enrolledAt: new Date(enrolledAt).toISOString(),
  };
}
