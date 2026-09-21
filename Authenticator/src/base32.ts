const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function normalizeBase32(value: string) {
  return value.toUpperCase().replace(/[\s=-]/g, "");
}

export function decodeBase32(value: string): Uint8Array {
  const normalized = normalizeBase32(value);
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error("Invalid Base32 secret");
  }

  let bits = 0;
  let bitCount = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid Base32 secret");
    bits = (bits << 5) | index;
    bitCount += 5;

    while (bitCount >= 8) {
      bitCount -= 8;
      output.push((bits >>> bitCount) & 0xff);
      bits &= (1 << bitCount) - 1;
    }
  }

  return Uint8Array.from(output);
}
