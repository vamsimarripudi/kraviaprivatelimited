import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180026_domain_certificate_control.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/domain-control-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-domains/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-domain-control.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA domain, DNS and TLS controls",()=>{
  it("wires a capability-gated domain control workspace",()=>{
    expect(officeSections.domains.title).toBe("Domains & certificates");
    expect(requiredCapabilities("office","domains")).toContain("infra.domain.read");
    expect(requiredCapabilities("office","domains")).toContain("infra.dns.verify");
    expect(screen).toContain("OfficeDomainControl");
  });

  it("stores hashes and references instead of raw DNS secrets or TLS private keys",()=>{
    expect(migration).toContain("expected_value_sha256");
    expect(migration).toContain("observed_value_sha256");
    expect(migration).toContain("fingerprint_sha256");
    expect(migration).not.toMatch(/private_key|registrar_password|dns_api_key/i);
    expect(component).toContain('crypto.subtle.digest("SHA-256"');
    expect(component).toContain("Raw value is not sent to KRAVIA");
    expect(component).toContain("Never paste a private key");
    expect(route).not.toContain("expected_value:");
    expect(route).not.toContain("observed_value:");
  });

  it("requires independent review and verification of DNS changes",()=>{
    expect(migration).toContain("DNS change proposer cannot independently approve the same change");
    expect(migration).toContain("DNS proposer/executor cannot independently verify the same change");
    expect(migration).toContain("Observed DNS hash does not match approved expected value");
    expect(component).toContain("Independent review");
    expect(component).toContain("Verify observed DNS");
  });

  it("records provider application evidence without claiming automatic provider execution",()=>{
    expect(migration).toContain("Provider application evidence is required");
    expect(route).toContain("MARK_DNS_APPLIED");
    expect(component).toContain("This does not claim KRAVIA changed DNS automatically");
  });

  it("keeps domain and certificate mutations server-authorised and same-origin",()=>{
    expect(route).toContain("officeMutationIsSameOrigin(request)");
    expect(server).toContain("resolveOfficePermission");
    expect(server).toContain("infra.domain.manage");
    expect(server).toContain("infra.dns.verify");
  });
});
