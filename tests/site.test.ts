import { describe, expect, it } from "vitest";
import { companyProfile, publicPages } from "../lib/site";
describe("public company data", () => { it("does not manufacture statutory identifiers", () => { expect(companyProfile.cin).toBeNull(); expect(companyProfile.gst.gstin).toBeNull(); }); it("keeps required public route content available", () => { expect(Object.keys(publicPages)).toEqual(expect.arrayContaining(["company", "products", "governance", "disclosures", "trust/data-protection"])); }); });
