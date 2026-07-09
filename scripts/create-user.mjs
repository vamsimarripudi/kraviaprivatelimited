import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const [, , emailArg, nameArg, roleArg] = process.argv;
const email = String(emailArg || "").trim().toLowerCase();
const name = String(nameArg || "").trim();
const role = String(roleArg || "").trim().toLowerCase();

if (!email || !name || !["founder", "director", "viewer"].includes(role)) {
  console.error("Usage: npm run create-user -- email@example.com \"Full Name\" founder|director|viewer");
  process.exit(1);
}

const password = process.env.KRAVIA_USER_PASSWORD || (await askPassword());
if (!password || password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const iterations = 310000;
const digest = "sha256";
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, digest);
const passwordHash = `pbkdf2$${digest}$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}`;

console.log(JSON.stringify({ email, name, role, passwordHash }, null, 2));

async function askPassword() {
  const reader = createInterface({ input, output });
  const value = await reader.question("Password: ");
  reader.close();
  return value;
}
