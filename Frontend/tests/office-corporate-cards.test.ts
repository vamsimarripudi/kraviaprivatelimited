import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financeSections, officeSections } from "../lib/office/workspaces";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const base=readFileSync(new URL("../../Database/supabase/migrations/202609180031_corporate_cards.sql",import.meta.url),"utf8");
const enforcement=readFileSync(new URL("../../Database/supabase/migrations/202609180032_corporate_card_enforcement.sql",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/office/corporate-card-server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/office-corporate-cards/route.ts",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-corporate-cards.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");

describe("KRAVIA corporate-card controls",()=>{
 it("is available as scoped self-service and Finance control",()=>{
  expect(officeSections.cards.title).toBe("Corporate cards");
  expect(financeSections.cards.title).toBe("Corporate cards");
  expect(requiredCapabilities("office","cards")).toContain("finance.card.spend.request");
  expect(requiredCapabilities("finance","cards")).toContain("finance.card.review");
  expect(screen).toContain("OfficeCorporateCards");
 });

 it("stores only masked card/control metadata and never card secrets",()=>{
  expect(base).toContain("last4 char(4)");
  const schemaOnly=base.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
  expect(schemaOnly).not.toMatch(/\bpan\b|\bcvv\b|\bpin\b|magnetic_stripe|cryptogram|card_token/i);
  expect(component).toContain("Do not enter a full card number, CVV, PIN or issuer token");
  expect(server).toContain("never stores PAN, CVV, PIN, magnetic-stripe data, cryptograms or issuer payment tokens");
 });

 it("uses maker-checker card activation and spend approval",()=>{
  expect(base).toContain("Cardholder/creator cannot independently review the same corporate card");
  expect(base).toContain("Requester cannot approve their own card spend");
  expect(component).toContain("Review controls");
  expect(component).toContain("Review spend");
 });

 it("enforces category, per-transaction and monthly limits server-side",()=>{
  expect(enforcement).toContain("Merchant category is outside the approved card policy");
  expect(enforcement).toContain("Requested amount exceeds card per-transaction limit");
  expect(enforcement).toContain("Approval would exceed the corporate card monthly limit");
 });

 it("records issuer transaction and receipt evidence without executing card payments",()=>{
  expect(base).toContain("Issuer transaction reference and receipt reference are required");
  expect(base).toContain("no card transaction was executed by KRAVIA");
  expect(component).toContain("KRAVIA will not execute the transaction");
 });

 it("protects browser mutations and scopes card data by own, department or company authority",()=>{
  expect(route).toContain("officeMutationIsSameOrigin(request)");
  expect(server).toContain('cardQuery=cardQuery.eq("cardholder_user_id",current.identity.userId)');
  expect(server).toContain('cardQuery=cardQuery.eq("department_code",current.department)');
 });
});
