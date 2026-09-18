import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const migration=readFileSync(new URL("../../Database/supabase/migrations/202609180034_secure_custody.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/custody-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-custody/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-secure-custody.tsx",import.meta.url),"utf8");
const search=readFileSync(new URL("../lib/office/search-server.ts",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA secure physical custody",()=>{
 it("is capability-gated and wired into Office",()=>{
  expect(officeSections.custody.title).toBe("Secure custody");
  expect(requiredCapabilities("office","custody")).toContain("custody.checkout");
  expect(requiredCapabilities("office","custody")).toContain("custody.review");
  expect(screen).toContain("OfficeSecureCustody");
 });

 it("tracks DSC tokens and originals without secret material",()=>{
  expect(migration).toContain("'DSC_TOKEN'");
  expect(migration).toContain("'ORIGINAL_DOCUMENT'");
  expect(migration).toContain("'SHARE_CERTIFICATE'");
  expect(migration).not.toMatch(/signing_pin|private_key|token_secret|recovery_phrase|password_value/i);
  expect(server).toContain("never stores DSC/signing PINs, private keys, token secrets");
  expect(component).toContain("Never enter a DSC/signing PIN, private key, token secret");
 });

 it("requires purpose, recipient and return evidence for checkout lifecycle",()=>{
  expect(migration).toContain("Secure-item checkout permission is required");
  expect(migration).toContain("Return evidence is required");
  expect(component).toContain("Related reference");
  expect(component).toContain("Due back");
 });

 it("uses independent verification or loss declaration",()=>{
  expect(migration).toContain("Checkout recipient/issuer cannot independently verify the same return");
  expect(migration).toContain("Checkout recipient/issuer cannot independently declare the same item lost");
  expect(component).toContain("Verify return");
  expect(component).toContain("Declare lost");
 });

 it("preserves custody history and avoids destructive item deletion",()=>{
  expect(migration).not.toMatch(/delete\s+from\s+public\.office_secure_custody/i);
  expect(migration).toContain("office_secure_custody_events");
 });

 it("does not expose secure custody in global search and protects mutations",()=>{
  expect(search).not.toContain("office_secure_custody_items");
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain("resolveOfficePermission");
 });
});
