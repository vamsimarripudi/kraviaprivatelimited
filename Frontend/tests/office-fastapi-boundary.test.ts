import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const legacyFastApiTables = new Set([
  "accounting_period_locks","alembic_version","approval_requests","audit_events","authority_grants",
  "bank_accounts","bank_transactions","board_meetings","chart_accounts","commercial_plans",
  "compliance_obligations","contracts","contribution_allocations","contribution_calls","controlled_sequences",
  "credit_notes","customers","document_versions","documents","employees","event_outbox",
  "expense_obligations","finance_provider_events","funding_policies","idempotency_records","inspection_cases",
  "integration_registry","invoice_sequences","invoices","journal_entries","journal_lines","legal_entities",
  "notice_cases","office_assets","operational_alerts","payment_attempts","payment_instructions","payment_mandates",
  "payments","products","receipts","refunds","resolutions","settlements","share_change_requests",
  "share_classes","share_ledger_entries","share_transfer_requests","shareholders","subscriptions","vendors",
  "workflow_runs",
]);

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? filesUnder(path)
      : path.endsWith(".ts") || path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

describe("KRAVIA Office FastAPI ownership boundary", () => {
  it("does not query FastAPI-owned legacy tables directly through Supabase", () => {
    const root = resolve(import.meta.dirname, "../lib/office");
    const violations: string[] = [];

    for (const path of filesUnder(root)) {
      const content = readFileSync(path, "utf8");
      for (const match of content.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
        const table = match[1];
        if (legacyFastApiTables.has(table)) {
          violations.push(`${relative(root, path)} -> ${table}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps legacy business data behind the same-origin FastAPI runtime gateway", () => {
    const gateway = readFileSync(new URL("../app/api/office-runtime/[...path]/route.ts", import.meta.url), "utf8");
    expect(gateway).toContain("officeMutationIsSameOrigin(request)");
    expect(gateway).toContain("getOfficeRuntimeOrigin()");
    expect(gateway).toContain('headers.set("Authorization"');
  });
});
