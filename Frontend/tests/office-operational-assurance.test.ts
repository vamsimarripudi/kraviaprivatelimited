import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../Database/supabase/migrations/202609170005_operational_assurance.sql", import.meta.url), "utf8");
const scopeMigration = readFileSync(new URL("../../Database/supabase/migrations/202609170006_request_scope_authorization.sql", import.meta.url), "utf8");
const readGrantMigration = readFileSync(new URL("../../Database/supabase/migrations/202609170007_office_read_model_grants.sql", import.meta.url), "utf8");
const screen = readFileSync(new URL("../components/internal-workspace-screen.tsx", import.meta.url), "utf8");
const capabilities = readFileSync(new URL("../lib/office/workspace-capabilities.ts", import.meta.url), "utf8");
const support = readFileSync(new URL("../lib/office/support-server.ts", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../lib/office/privacy-server.ts", import.meta.url), "utf8");
const dataMovement = readFileSync(new URL("../lib/office/data-movement-server.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../lib/office/security-overview-server.ts", import.meta.url), "utf8");
const readiness = readFileSync(new URL("../lib/office/readiness-server.ts", import.meta.url), "utf8");
const supportRoute = readFileSync(new URL("../app/api/office-support/route.ts", import.meta.url), "utf8");
const privacyRoute = readFileSync(new URL("../app/api/office-privacy/route.ts", import.meta.url), "utf8");
const dataRoute = readFileSync(new URL("../app/api/office-data-movement/route.ts", import.meta.url), "utf8");
const securityRoute = readFileSync(new URL("../app/api/office-security-overview/route.ts", import.meta.url), "utf8");
const readinessRoute = readFileSync(new URL("../app/api/office-readiness/route.ts", import.meta.url), "utf8");

describe("Office operational assurance", () => {
  it("separates support case handling from refund execution", () => {
    expect(migration).toContain("office_support_cases");
    expect(support).toContain("CUSTOMER_REFUND");
    expect(support).toContain("Support resolution and refund authority are separate");
    expect(supportRoute).toContain("officeMutationIsSameOrigin");
  });

  it("records privacy work without fabricating legal completion", () => {
    expect(migration).toContain("office_privacy_cases");
    expect(migration).toContain("office_retention_rules");
    expect(migration).toContain("office_legal_holds");
    expect(privacy).toContain("not legal conclusions");
    expect(privacyRoute).toContain("officeMutationIsSameOrigin");
  });

  it("makes import and export approval-only and resource scoped", () => {
    expect(migration).toContain("DATA_EXPORT");
    expect(migration).toContain("DATA_IMPORT");
    expect(scopeMigration).toContain("normalized_resource_type");
    expect(scopeMigration).toContain("data.export.request");
    expect(scopeMigration).toContain("data.import.request");
    expect(dataMovement).toContain("does not release exports, ingest files or mutate canonical records automatically");
    expect(dataRoute).toContain("officeMutationIsSameOrigin");
  });

  it("keeps security overview read-only and excludes employee spyware", () => {
    expect(capabilities).toContain('"office:security": ["security.overview.read", "security.change.review"]');
    expect(security).toContain("does not capture keystrokes, screenshots or continuous employee surveillance");
    expect(securityRoute).toContain("export async function GET");
    expect(securityRoute).not.toContain("export async function POST");
  });

  it("reports readiness as evidence gates rather than a compliance score", () => {
    expect(readiness).toContain("not a compliance certificate, legal opinion or uptime guarantee");
    expect(readiness).toContain("Missing data is surfaced as missing or attention rather than assumed healthy");
    expect(readiness).toContain("First-party auth runtime configured");
    expect(readiness).toContain("OFFICE_API_ORIGIN");
    expect(readiness).toContain('office_auth_sessions_v2');
    expect(readiness).toContain("Active first-party sessions");
    expect(readiness).not.toContain('from("office_auth_sessions")');
    expect(readiness).not.toContain("OFFICE_SUPABASE_PUBLISHABLE_KEY");
    expect(readinessRoute).toContain("export async function GET");
    expect(readinessRoute).not.toContain("export async function POST");
  });

  it("surfaces all assurance workspaces and grants only selected legacy read models", () => {
    for (const component of ["OfficeSupportOperations", "OfficeDataMovement", "OfficePrivacyGovernance", "OfficeSecurityOverview", "OfficeReadiness"]) expect(screen).toContain(component);
    expect(readGrantMigration).toContain("grant select on public.customers to service_role");
    expect(readGrantMigration).not.toContain("grant insert on public.customers");
    expect(readGrantMigration).not.toContain("grant update on public.customers");
  });
});
