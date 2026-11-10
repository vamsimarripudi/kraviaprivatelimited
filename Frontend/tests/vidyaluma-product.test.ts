import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { publicProducts } from "../lib/corporate-content";
import { vidyaLumaProduct } from "../lib/products/vidyaluma";

describe("VidyaLuma public product record", () => {
  it("is an official Kravia product with a corporate overview and canonical product destination", () => {
    expect(publicProducts).toContainEqual(vidyaLumaProduct);
    expect(vidyaLumaProduct.href).toBe("/products/vidyaluma");
    expect(vidyaLumaProduct.website).toBe("https://vidyaluma.in");
    expect(vidyaLumaProduct.public).toBe(true);
  });

  it("preserves the independent product identity and product-enquiry context", () => {
    expect(vidyaLumaProduct.name).toBe("VidyaLuma");
    expect(vidyaLumaProduct.enquiryCategory).toContain("VidyaLuma");
    expect(vidyaLumaProduct.enquiryCategory).toContain("School Intelligence & Operations Platform");
  });

  it("describes role-specific, educator-approved school workflows rather than generic agency services", () => {
    expect(vidyaLumaProduct.platformAreas).toHaveLength(4);
    const content = JSON.stringify(vidyaLumaProduct).toLowerCase();
    for (const term of ["attendance", "fee", "answer-sheet", "teacher-reviewed", "report", "parent", "school", "subscription"]) {
      expect(content).toContain(term);
    }
    expect(vidyaLumaProduct.faqs.some(([question]) => question.includes("outsourced software project"))).toBe(true);
    expect(vidyaLumaProduct.faqs.some(([question, answer]) => question.includes("parents") && answer.includes("approved"))).toBe(true);
    expect(vidyaLumaProduct.faqs.some(([question, answer]) => question.includes("available today") && answer.includes("enabled modules"))).toBe(true);
  });

  it("links first-party product, school-plan, and trust evidence in the existing KRAVIA layout", () => {
    const page = readFileSync(resolve(process.cwd(), "components/vidyaluma-product-page.tsx"), "utf8");
    const startup = readFileSync(resolve(process.cwd(), "components/public-page-content.tsx"), "utf8");
    for (const path of ["/product", "/pricing", "/trust"]) {
      expect(page).toContain(`https://vidyaluma.in${path}`);
      expect(startup).toContain(`https://vidyaluma.in${path}`);
    }
    expect(page).toContain("vidyaluma-area-grid");
    expect(page).toContain("vidyaluma-hero");
    expect(page).toContain("vidyaluma-principle-grid");
    expect(page).toContain("vidyaluma-faq");
    expect(page).not.toContain("Student names from production");
  });

  it("does not rely on fabricated commercial, performance, or certification claims", () => {
    const publicCopy = JSON.stringify(vidyaLumaProduct).toLowerCase();
    expect(publicCopy).not.toContain("trusted by");
    expect(publicCopy).not.toContain("certified");
    expect(publicCopy).not.toContain("#1");
    expect(publicCopy).not.toContain("100%");
  });
});