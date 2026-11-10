import { describe, expect, it } from "vitest";
import { publicCorporateEmails, publicEnquiryEmail } from "../lib/corporate/public-email-directory";

describe("KRAVIA public email directory", () => {
  it("publishes only dedicated KRAVIA addresses, not every Google Workspace alias", () => {
    expect(Object.values(publicCorporateEmails)).toHaveLength(11);
    for (const address of Object.values(publicCorporateEmails)) {
      expect(address).toMatch(/^[a-z-]+@kraviaprivatelimited\.com$/);
    }
    expect(Object.values(publicCorporateEmails)).not.toContain("security@kraviaprivatelimited.com");
    expect(Object.values(publicCorporateEmails)).not.toContain("grievance@kraviaprivatelimited.com");
    expect(Object.values(publicCorporateEmails)).not.toContain("hr@kraviaprivatelimited.com");
  });

  it("routes common public enquiries to the correct aliases", () => {
    expect(publicEnquiryEmail("Product enquiry")).toBe(publicCorporateEmails.products);
    expect(publicEnquiryEmail("Partnership")).toBe(publicCorporateEmails.partnerships);
    expect(publicEnquiryEmail("Media / corporate enquiry")).toBe(publicCorporateEmails.press);
    expect(publicEnquiryEmail("Careers")).toBe(publicCorporateEmails.careers);
    expect(publicEnquiryEmail("General")).toBe(publicCorporateEmails.contact);
    expect(publicEnquiryEmail("Other corporate category")).toBe(publicCorporateEmails.contact);
  });

  it("never presents a direct shared-inbox email for restricted enquiries", () => {
    for (const category of ["Security", "Privacy", "Privacy question", "Grievance"]) {
      expect(publicEnquiryEmail(category)).toBeNull();
    }
  });
});
