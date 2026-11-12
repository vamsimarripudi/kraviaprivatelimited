import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PLACEHOLDERS, renderTemplateManifest } from "../templates/kravia.js";
import { OFFICE_LIFECYCLE_DISPATCH_ENABLED, validateOfficeLifecycleCatalog } from "../templates/office-lifecycle-catalog.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const target = resolve(scriptDirectory, "..", "..", "Backend", "backend", "generated_email_templates.json");
const check = process.argv.includes("--check");

validateOfficeLifecycleCatalog();
if (OFFICE_LIFECYCLE_DISPATCH_ENABLED !== false) throw new Error("Employee lifecycle send gate must remain disabled until signed event-to-template approval");

const requiredTokens = {
  office_sign_in_code: [PLACEHOLDERS.code, PLACEHOLDERS.expiryMinutes],
  office_device_approval: [PLACEHOLDERS.deviceLabel, PLACEHOLDERS.sourceAddress, PLACEHOLDERS.reviewUrl],
  public_request_received: [PLACEHOLDERS.name, PLACEHOLDERS.reference, PLACEHOLDERS.requestKind, PLACEHOLDERS.nextStep],
  public_request_update: [PLACEHOLDERS.name, PLACEHOLDERS.reference, PLACEHOLDERS.message],
  public_intake_internal_notification: [PLACEHOLDERS.name, PLACEHOLDERS.senderEmail, PLACEHOLDERS.reference, PLACEHOLDERS.requestKind, PLACEHOLDERS.requestSubject, PLACEHOLDERS.organisation],
  public_welcome: [PLACEHOLDERS.name],
  public_account_code: ["@@KRAVIA_CODE@@"],
  public_account_welcome: ["@@KRAVIA_NAME@@"],
  public_resource_receipt: ["@@KRAVIA_NAME@@","@@KRAVIA_RESOURCE_TITLE@@"],
  public_newsletter_confirm: ["@@KRAVIA_NAME@@","@@KRAVIA_ACTION_URL@@"],
  public_newsletter_welcome: ["@@KRAVIA_NAME@@"],
  public_newsletter_digest: ["@@KRAVIA_NAME@@","@@KRAVIA_ISSUE_SUBJECT@@","@@KRAVIA_MESSAGE@@","@@KRAVIA_UNSUBSCRIBE_URL@@"],
  public_newsletter_unsubscribed: ["@@KRAVIA_NAME@@"],
  public_account_security: ["@@KRAVIA_NAME@@","@@KRAVIA_MESSAGE@@"],
  public_preferences_changed: ["@@KRAVIA_NAME@@","@@KRAVIA_STATUS@@"],
  public_feedback_ack: ["@@KRAVIA_NAME@@","@@KRAVIA_REFERENCE@@"],
} as const;
const manifest = {
  format: 1,
  generatedBy: "EmailTemplates/scripts/build-manifest.ts",
  templates: await renderTemplateManifest(),
};

for (const [name, template] of Object.entries(manifest.templates)) {
  for (const token of requiredTokens[name as keyof typeof requiredTokens]) {
    const occurs = `${template.html}\n${template.text}`.includes(token);
    if (!occurs) throw new Error(`${name} is missing required placeholder ${token}`);
  }
  if (/\bjavascript:/i.test(template.html) || /<script\b/i.test(template.html)) {
    throw new Error(`${name} contains unsupported executable content`);
  }
}

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
let existing: string | undefined;
try {
  existing = await readFile(target, "utf8");
} catch (error: unknown) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}

if (check) {
  if (existing !== serialized) {
    throw new Error("Generated email manifest is stale. Run npm run build in EmailTemplates.");
  }
  process.stdout.write("React Email manifest is current.\n");
} else if (existing !== serialized) {
  await writeFile(target, serialized, "utf8");
  process.stdout.write(`Wrote ${target}\n`);
} else {
  process.stdout.write("React Email manifest is already current.\n");
}
