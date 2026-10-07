import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, "..");
const policy = JSON.parse(
  readFileSync(resolve(appDirectory, "security/npm-audit-exceptions.json"), "utf8"),
);

const reviewBy = new Date(`${policy.reviewBy}T23:59:59.999Z`);
if (Number.isNaN(reviewBy.valueOf()) || reviewBy.valueOf() < Date.now()) {
  throw new Error("The npm audit exception review date is missing or has expired.");
}

const auditArguments = ["audit", "--package-lock-only", "--audit-level=high", "--json"];
const npmCli = process.env.npm_execpath;
const auditEnvironment = { ...process.env };
delete auditEnvironment.npm_config_prefix;
delete auditEnvironment.npm_config_local_prefix;
const audit = npmCli
  ? spawnSync(process.execPath, [npmCli, ...auditArguments], {
      cwd: appDirectory,
      encoding: "utf8",
      env: auditEnvironment,
    })
  : spawnSync("npm", auditArguments, {
      cwd: appDirectory,
      encoding: "utf8",
      env: auditEnvironment,
    });

if (audit.error) {
  throw new Error(`Unable to run npm audit: ${audit.error.message}`);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  throw new Error(
    `npm audit did not return machine-readable output. ${audit.stderr.trim()}`.trim(),
  );
}

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const allowed = new Map(
  policy.exceptions.map((exception) => [
    `${exception.source}:${exception.package}:${exception.severity}`,
    exception,
  ]),
);
const observed = new Set();
const blocked = [];

for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const finding of vulnerability.via ?? []) {
    if (typeof finding === "string") continue;
    if ((severityRank[finding.severity] ?? -1) < severityRank.high) continue;

    const key = `${finding.source}:${finding.name}:${finding.severity}`;
    if (!allowed.has(key)) {
      blocked.push(`${finding.name} (${finding.severity}, advisory ${finding.source})`);
      continue;
    }
    observed.add(key);
  }
}

if (blocked.length > 0) {
  throw new Error(
    `Unapproved high-severity npm audit finding(s): ${[...new Set(blocked)].join(", ")}`,
  );
}

const unused = [...allowed.keys()].filter((key) => !observed.has(key));
if (unused.length > 0) {
  throw new Error(
    `The audit exception policy is stale; remove or review: ${unused.join(", ")}`,
  );
}

if (audit.status !== 0 && observed.size === 0) {
  throw new Error("npm audit failed without a reviewed high-severity leaf finding.");
}

if (observed.size > 0) {
  console.log(
    `npm audit policy: ${observed.size} reviewed build-tool advisory exception(s) remain; review by ${policy.reviewBy}.`,
  );
} else {
  console.log("npm audit policy: no high-severity findings.");
}
