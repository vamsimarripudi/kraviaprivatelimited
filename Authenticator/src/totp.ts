import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { decodeBase32 } from "./base32";

function counterBytes(counter: number) {
  const bytes = new Uint8Array(8);
  let value = Math.floor(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return bytes;
}

export function generateTotp(
  secret: string,
  timestampMs = Date.now(),
  digits = 6,
  period = 30,
) {
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error("TOTP digits must be between 6 and 8");
  }
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("TOTP period must be positive");
  }

  const key = decodeBase32(secret);
  const counter = Math.floor(timestampMs / 1000 / period);
  const mac = hmac(sha1, key, counterBytes(counter));
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary =
    ((mac[offset]! & 0x7f) << 24)
    | ((mac[offset + 1]! & 0xff) << 16)
    | ((mac[offset + 2]! & 0xff) << 8)
    | (mac[offset + 3]! & 0xff);
  const code = binary % (10 ** digits);
  return code.toString().padStart(digits, "0");
}

export function totpWindow(timestampMs = Date.now(), period = 30) {
  const seconds = Math.floor(timestampMs / 1000);
  const elapsed = seconds % period;
  return {
    remaining: period - elapsed,
    progress: (period - elapsed) / period,
  };
}
