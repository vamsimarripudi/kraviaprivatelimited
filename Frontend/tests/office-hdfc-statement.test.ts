import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const bank=read("components/office-banking.tsx");
const hdfc=read("components/office-hdfc-statement-import.tsx");
const styles=read("components/office-hdfc-statement-import.module.css");
const runtime=read("app/api/office-runtime/[...path]/route.ts");
const backend=read("../Backend/backend/hdfc_statement_import.py");
const main=read("../Backend/backend/main.py");

describe("Office HDFC manual statement integration",()=>{
 it("preserves current masked bank references and canonical transaction display",()=>{
  expect(bank).toContain("OfficeHdfcStatementImport");
  expect(bank).toContain('mode === "banking"');
  expect(bank).toContain("canImport={canImportTransaction}");
  expect(bank).toContain('runtime<BankAccount[]>("banking/accounts")');
  expect(bank).toContain("No bank-side payment execution");
 });
 it("honestly distinguishes an HDFC CSV evidence source from a connected banking API",()=>{
  expect(hdfc).toContain("Automatic bank API feed is not connected");
  expect(hdfc).toContain("not retrieved through a connected API");
  expect(hdfc).toContain("No transfers, bank credentials, OTPs");
  expect(backend).toContain('"live_bank_feed": False');
  expect(backend).toContain("HDFC_ENET_CSV");
  expect(backend).not.toContain("https://api.hdfc");
 });
 it("requires a validated HDFC account, explicit user review and immutable preview digest",()=>{
  expect(hdfc).toContain('includes("hdfc")');
  expect(hdfc).toContain('a.currency==="INR"');
  expect(hdfc).toContain('method:"POST",credentials:"same-origin"');
  expect(hdfc).toContain('preview_digest:preview.digest,confirm:true');
  expect(hdfc).toContain("disabled={busy||!approved||preview.issues.length>0||!preview.new_rows}");
  expect(runtime).toContain("officeMutationIsSameOrigin(request)");
  expect(backend).toContain('require_roles("OWNER", "FINANCE", "CA")');
  expect(backend).toContain("hmac.compare_digest");
  expect(backend).toContain("IntegrityError");
 });
 it("rejects unbounded imports, handles duplicates and does not write actual banking credentials",()=>{
  expect(hdfc).toContain("file.size>1_000_000");
  expect(backend).toContain("MAX_CSV_ROWS = 200");
  expect(backend).toContain('mode": "MANUAL_STATEMENT_EVIDENCE"');
  expect(backend).toContain("bank.statement.import_confirmed");
  expect(backend).toContain('"UNMATCHED"');
  expect(backend).not.toContain("bank_password");
  expect(backend).not.toContain("access_token");
 });
 it("supports mobile review in a neutral accessible overlay",()=>{
  expect(hdfc).toContain('role="dialog"');
  expect(hdfc).toContain('aria-modal="true"');
  expect(hdfc).toContain('role="alert"');
  expect(styles).toContain("@media(max-width:650px)");
  expect(styles).toContain("max-height:calc(100dvh - 12px)");
  expect(styles).not.toContain("#22c55e");
 });
 it("exposes the HDFC endpoints on existing first-party Office FastAPI",()=>{
  expect(main).toContain("build_hdfc_statement_router");
  expect(backend).toContain('router.post("/statement/preview")');
  expect(backend).toContain('router.post("/statement/confirm")');
 });
});
