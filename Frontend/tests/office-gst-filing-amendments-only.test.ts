import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const gst=read("components/office-gst-tax.tsx");
const compliance=read("../Backend/backend/gst_compliance.py");
const policy=read("../docs/office/gst-filing-and-registration-changes-policy-20261115.md");

describe("KRAVIA GST scope: filing and registration changes, no e-invoicing",()=>{
 it("maintains the existing CA-reviewed GSTR-1 and GSTR-3B flow",()=>{
  expect(gst).toContain('key: "returns", label: "Returns"');
  expect(gst).toContain('tax/gst/returns/build');
  expect(gst).toContain('tax/gst/gsp/returns/');
  expect(gst).toContain('CA approve');
  expect(gst).toContain('ARN verified');
  expect(compliance).toContain('"/returns/{return_id}/filing-evidence"');
 });
 it("introduces a clearly labelled registration change and notice view with GSTN as source",()=>{
  expect(gst).toContain('key: "changes", label: "Registration changes"');
  expect(gst).toContain('Registration amendments and GST notices');
  expect(gst).toContain('My Saved Applications');
  expect(gst).toContain('saved draft is not a submitted amendment');
  expect(gst).toContain('https://www.gst.gov.in/');
  expect(gst).toContain('View Notices and Orders');
  expect(gst).toContain('An absence of Office data does not mean the GST portal return is unfiled.');
 });
 it("does not offer IRN generation or cancellation while e-invoicing is off by policy",()=>{
  expect(gst).toContain('const EINVOICE_UI_ENABLED = false;');
  expect(gst).toContain('const canGenerate = Boolean(EINVOICE_UI_ENABLED &&');
  expect(gst).toContain('{EINVOICE_UI_ENABLED ? <td className={styles.irnCell}>');
  expect(gst).toContain('{EINVOICE_UI_ENABLED ? <details className={styles.settingsBlock}>');
  expect(gst).toContain('E-invoicing is not enabled.');
  expect(policy).toContain('Do not enable IRP/e-invoice creation');
 });
 it("does not equate internal records to a GST portal filing or make ITC claims",()=>{
  expect(gst).toContain('no filing is inferred');
  expect(gst).toContain('ITC review');
  expect(gst).toContain('monthly or QRMP selection');
  expect(policy).toContain('GST Portal remains the authoritative source');
 });
});