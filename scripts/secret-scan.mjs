import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ignored = new Set(["node_modules", ".next", ".git"]);
const patterns = [/SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)\s*=\s*(?!\s*$|YOUR_|\$\{)[^\s]+/i, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/];
function walk(directory) { return readdirSync(directory).flatMap((name) => { if (ignored.has(name)) return []; const path = join(directory, name); return statSync(path).isDirectory() ? walk(path) : [path]; }); }
const matches = walk(process.cwd()).filter((file) => !file.endsWith(".lock") && patterns.some((pattern) => pattern.test(readFileSync(file, "utf8"))));
if (matches.length) { console.error(`Potential secret material found in: ${matches.join(", ")}`); process.exit(1); }
console.log("Secret scan passed.");
