import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { decodeBase32 } from "./base32";

function decodeAuthenticatorSecret(secret: string) {
  try {
    const bytes = decodeBase32(secret);
    if (bytes.length < 10) throw new Error("too short");
    return bytes;
  } catch {
    throw new Error("Authenticator secret is invalid.");
  }
}

function counterBytes(counter: number) {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error("Authenticator clock is invalid.");
  }
  const output = new Uint8Array(8);
  let value = counter;
  for (let index = output.length - 1; index >= 0; index -= 1) {
    output[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return output;
}

export type TotpValue = {
  code: string;
  remaining: number;
  period: number;
  progress: number;
};

export function currentTotp(
  secret: string,
  now = Date.now(),
  { digits = 6, period = 30 }: { digits?: number; period?: number } = {},
): TotpValue {
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error("Authenticator code length is invalid.");
  }
  if (!Number.isInteger(period) || period < 15 || period > 120) {
    throw new Error("Authenticator code period is invalid.");
  }
  const seconds = Math.floor(now / 1_000);
  const counter = Math.floor(seconds / period);
  const digest = hmac(sha1, decodeAuthenticatorSecret(secret), counterBytes(counter));
  const offset = digest[digest.length - 1]! & 0x0f;
  if (offset + 3 >= digest.length) {
    throw new Error("Authenticator code could not be generated.");
  }
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  const divisor = 10 ** digits;
  const currentSecond = ((seconds % period) + period) % period;
  return {
    code: (binary % divisor).toString().padStart(digits, "0"),
    remaining: Math.max(1, period - currentSecond),
    period,
    progress: currentSecond / period,
  };
}
