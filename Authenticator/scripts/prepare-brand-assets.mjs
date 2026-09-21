import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "assets-source", "brand-assets.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const EXPECTED = Object.freeze({
  icon: "4c46b22a325a1a199292c3b2a128291ee6ba2161799143e3decea39a1c1dd44d",
  splash: "4ed3432c1470c3b2f35bdf4ea2583a4bd3f23ef4176ea0ff084c7a3199d6db4f",
  loading: "8fb4df780b665c6d0b394510ab5b9345d2799051553d75527dee8fafc724920f",
  settings_reference: "8170fe77d82c238e57901724408021d7533bddaabb79aa2a9d2754a9ebbd6c1a",
});

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

for (const [name, expectedHash] of Object.entries(EXPECTED)) {
  const item = source[name];
  if (!item || !Array.isArray(item.chunks) || typeof item.target !== "string") {
    throw new Error(`KRAVIA brand asset source is incomplete: ${name}`);
  }
  if (item.sha256 !== expectedHash) {
    throw new Error(`KRAVIA brand asset manifest hash changed: ${name}`);
  }

  const bytes = Buffer.from(item.chunks.join(""), "base64");
  const actualHash = sha256(bytes);
  if (bytes.length !== item.size || actualHash !== expectedHash) {
    throw new Error(`KRAVIA brand asset integrity check failed: ${name}`);
  }

  const output = resolve(root, item.target);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, bytes);
  console.log(`Prepared locked KRAVIA brand asset ${name} ${bytes.length} bytes ${actualHash}`);
}
