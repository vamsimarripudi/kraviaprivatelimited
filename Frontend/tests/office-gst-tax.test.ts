import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredCapabilities } from "../lib/office/workspace-capabilities";

const component=readFileSync(new URL("../components/office-gst-tax.tsx",import.meta.url),"utf8");
const screen=readFileSync(new URL("../components/internal-workspace-screen.tsx",import.meta.url),"utf8");
const backend=readFileSync(new URL("../../Backend/backend/main.py",import.meta.url),"utf8");

describe("KRAVIA Finance GST working register",()=>{
  it("uses a specialised GST workspace backed by canonical invoice runtime data",()=>{
    expect(screen).toContain("OfficeGstTaxWorkspace");
    expect(component).toContain('runtime<GstSummary>("tax/gst/summary"');
    expect(component).toContain('runtime<Invoice[]>("invoices"');
    expect(component).toContain('runtime<GstMaster>("tax/gst/master"');
    expect(component).toContain('runtime<ProductTaxProfile[]>("tax/gst/product-profiles"');
    expect(component).toContain('runtime<GstConfiguration>("tax/gst/configuration"');
    expect(component).toContain('runtime<GstConnectorStatus>("tax/gst/connector/status"');
    expect(component).toContain('runtime<EinvoiceRecord[]>("tax/gst/einvoice"');
    expect(component).toContain("document_hash");
  });

  it("retains explicit preparation and independent review capability signals",()=>{
    expect(requiredCapabilities("finance","gst")).toContain("tax.gst.prepare");
    expect(requiredCapabilities("finance","gst")).toContain("tax.gst.approve");
    expect(component).toContain("Prepare");
    expect(component).toContain("Review");
  });

  it("does not fabricate input-tax credit, payable tax, filing or compliance status",()=>{
    expect(component).toContain("Input tax credit is not calculated");
    expect(component).toContain("No GST portal filing is performed or inferred");
    expect(component).toContain("no net GST payable is claimed");
    expect(backend).toContain("Working sales-register summary only; no GST portal filing is performed.");
  });

  it("keeps the register invoice-derived and period filterable",()=>{
    expect(component).toContain("Working period");
    expect(component).toContain("SALES REGISTER");
    expect(component).toContain("Net taxable sales");
    expect(component).toContain("CGST");
    expect(component).toContain("SGST");
    expect(component).toContain("IGST");
  });

  it("renders controlled product tax profiles and production readiness without inferring portal status",()=>{
    expect(component).toContain("PRODUCTION TAX CONTROL");
    expect(component).toContain("PRODUCT TAX PROFILES");
    expect(component).toContain("Backend-owned SAC and GST configuration");
    expect(component).toContain("GST portal evidence");
    expect(component).toContain("CA evidence required");
  });

  it("exposes credential-gated real IRP operations without fake provider success",()=>{
    expect(component).toContain("LIVE GST CONNECTOR");
    expect(component).toContain("IRIS IRP core API");
    expect(component).toContain('"tax/gst/connector/health"');
    expect(component).toContain('"tax/gst/connector/verify-gstin"');
    expect(component).toContain('"tax/gst/einvoice/" + encodeURIComponent(invoice.id) + "/generate"');
    expect(component).toContain('"tax/gst/einvoice/" + encodeURIComponent(invoice.id) + "/cancel"');
    expect(component).toContain("No credential value is exposed or stored in the browser.");
    expect(component).toContain("Buyer GSTIN + billing address/locality/pincode required.");
  });

  it("renders the GSTN rate master and keeps 18% explicit for IT services",()=>{
    expect(component).toContain("GSTN / IRP RATE MASTER");
    expect(component).toContain("IT services default");
    expect(component).toContain("IT-service SAC reference");
    expect(component).toContain("0% control");
  });
});
