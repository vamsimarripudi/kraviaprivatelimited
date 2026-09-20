import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const permission=readFileSync(new URL("../../Database/supabase/migrations/202609180039_finance_receipt_permission.sql",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/office-billing.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const gateway=readFileSync(new URL("../app/api/office-runtime/[...path]/route.ts",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Finance billing actions",()=>{
 it("separates invoice issuance from received-payment authority",()=>{
  expect(requiredCapabilities("finance","billing")).toContain("finance.invoice.create");
  expect(requiredCapabilities("finance","billing")).toContain("finance.receipt.record");
  expect(permission).toContain("'finance.receipt.record'");
  expect(screen).toContain("OfficeBillingWorkspace");
 });

 it("uses the canonical GST rate master instead of an arbitrary percentage input",()=>{
  expect(component).toContain('runtime<GstMaster>("tax/gst/master")');
  expect(component).toContain("gstMaster?.standard_rates");
  expect(component).toContain("IT services");
  expect(component).not.toContain('type="number" min="0" max="100" step="0.01"');
 });

 it("keeps production tax invoicing fail-closed until controlled GST configuration is approved",()=>{
  expect(backend).toContain('if APP_ENV == "production" and (not KRAVIA_GSTIN or not TAX_CONFIG_APPROVED)');
  expect(backend).toContain("Production tax invoicing blocked until GSTIN and approved tax configuration are locked");
  expect(component).toContain("Production GST invoicing remains blocked");
 });

 it("creates immutable invoice snapshot/hash and double-entry journal in the backend",()=>{
  expect(backend).toContain("document_hash=hashlib.sha256");
  expect(backend).toContain("snapshot_json=json.dumps");
  expect(backend).toContain('post_journal(db,"INVOICE"');
  expect(component).toContain("Invoice integrity");
 });

 it("uses same-origin idempotent runtime mutations",()=>{
  expect(component).toContain('"Idempotency-Key":key()');
  expect(gateway).toContain("officeMutationIsSameOrigin(request)");
  expect(gateway).toContain('"idempotency-key"');
  expect(backend).toContain('get_idempotent(db,idempotency_key,"invoice.issue")');
  expect(backend).toContain('get_idempotent(db,idempotency_key,"payment.record")');
 });

 it("blocks duplicate external payment references and overpayment",()=>{
  expect(backend).toContain("Payment exceeds invoice balance");
  expect(backend).toContain("Payment external reference already recorded");
 });

 it("records externally received payment and creates a receipt without initiating transfer",()=>{
  expect(backend).toContain('receipt_no=allocate_invoice_no(db,"R")');
  expect(component).toContain("This records money already received. It does not initiate a transfer.");
  expect(component).toContain("Record received payment");
 });
});
