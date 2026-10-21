import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicPageContent = readFileSync(resolve(process.cwd(), "components/public-page-content.tsx"), "utf8");
const corporatePage = readFileSync(resolve(process.cwd(), "components/corporate-information-page.tsx"), "utf8");
const footer = readFileSync(resolve(process.cwd(), "components/footer.tsx"), "utf8");
const corporateContent = readFileSync(resolve(process.cwd(), "lib/corporate-content.ts"), "utf8");
const structuredData = readFileSync(resolve(process.cwd(), "components/structured-data.tsx"), "utf8");

describe("corporate information surface", () => {
  it("renders a real dedicated route instead of falling back to an empty generic page", () => {
    expect(publicPageContent).toContain('slug === "company/corporate-information"');
    expect(publicPageContent).toContain("CorporateInformationPage");
  });

  it("uses one approved identity source across the footer, page and organization data", () => {
    expect(corporateContent).toContain("export const corporateIdentity");
    expect(corporateContent).toContain("U62011AP2026PTC126691");
    expect(corporateContent).toContain("37AANCK0043M1ZA");
    expect(corporateContent).toContain("DIPP281524");
    expect(corporateContent).toContain("UDYAM-AP-18-0057505");
    expect(footer).toContain("getPublicCompanyProfile");
    expect(corporatePage).toContain("corporateIdentity.pan");
    expect(structuredData).toContain("corporateIdentity.registeredOffice");
  });

  it("keeps PAN off the primary footer and protects external verification links", () => {
    expect(footer).not.toContain("corporateIdentity.pan");
    expect(corporatePage).toContain('rel="noopener noreferrer"');
    expect(footer).toContain('rel="noopener noreferrer"');
    expect(corporatePage).toContain("not an approval, certification or endorsement");
  });
});
