import { KRAVIA_ISSUER, type KraviaTotpAccount } from "./types";
import { normalizeBase32 } from "./base32";

function requiredKraviaSecret(value: string | null) {
  const secret = normalizeBase32(value ?? "");
  if (secret.length < 16 || !/^[A-Z2-7]+$/.test(secret)) {
    throw new Error("This KRAVIA enrollment secret is invalid");
  }
  return secret;
}

function accountFromLabel(pathname: string) {
  const decoded = decodeURIComponent(pathname.replace(/^\//, ""));
  const prefix = `${KRAVIA_ISSUER}:`;
  const account = decoded.startsWith(prefix) ? decoded.slice(prefix.length) : decoded;
  if (!account || !account.includes("@")) {
    throw new Error("KRAVIA enrollment is missing the corporate account");
  }
  return account;
}

export function parseKraviaProvisioningUri(value: string): KraviaTotpAccount {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Scan a valid KRAVIA Office authenticator QR code");
  }

  if (url.protocol !== "otpauth:" || url.hostname !== "totp") {
    throw new Error("Only TOTP KRAVIA Office enrollment codes are accepted");
  }

  const issuer = url.searchParams.get("issuer");
  if (issuer !== KRAVIA_ISSUER) {
    throw new Error("This QR code was not issued by KRAVIA Office");
  }

  const algorithm = (url.searchParams.get("algorithm") ?? "SHA1").toUpperCase();
  const digits = Number(url.searchParams.get("digits") ?? "6");
  const period = Number(url.searchParams.get("period") ?? "30");
  if (algorithm !== "SHA1" || digits !== 6 || period !== 30) {
    throw new Error("Unsupported KRAVIA authenticator parameters");
  }

  return {
    version: 1,
    issuer: KRAVIA_ISSUER,
    account: accountFromLabel(url.pathname),
    secret: requiredKraviaSecret(url.searchParams.get("secret")),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    enrolledAt: new Date().toISOString(),
  };
}

export function manualKraviaAccount(email: string, secretInput: string): KraviaTotpAccount {
  const account = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) {
    throw new Error("Enter the KRAVIA Office account email");
  }
  return {
    version: 1,
    issuer: KRAVIA_ISSUER,
    account,
    secret: requiredKraviaSecret(secretInput),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    enrolledAt: new Date().toISOString(),
  };
}
