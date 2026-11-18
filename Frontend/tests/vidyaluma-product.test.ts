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
    expect(vidyaLumaProduct.faqs.some(([question, answer]) => question.includes("available today") && answer.toLowerCase().includes("enabled modules"))).toBe(true);
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

  it("presents a dated development record with accurate code-versus-release boundaries", () => {
    const development = vidyaLumaProduct.development;
    expect(development.reviewedOn).toBe("2026-11-18");
    expect(development.workstreams).toHaveLength(6);
    expect(development.workstreams.map((item) => item.title)).toContain("Academic intelligence and reports");
    expect(development.workstreams.map((item) => item.title)).toContain("Analytics and observability");
    expect(development.recentUpdates).toHaveLength(3);
    expect(development.workstreams.some((item) => item.stage === "frontend")).toBe(true);
    expect(JSON.stringify(development).toLowerCase()).toContain("vsip");
    expect(development.intro).toContain("does not mean it is deployed");

    const page = readFileSync(resolve(process.cwd(), "components/vidyaluma-product-page.tsx"), "utf8");
    expect(page).toContain("04 / PRODUCT DEVELOPMENT DETAILS");
    expect(page).toContain('id="vidyaluma-development-title"');
    expect(page).toContain("development.recentUpdates.map");
    expect(page).toContain("development.workstreams.map");
    expect(page).toContain("08 / FAQ");
  });

  it("does not rely on fabricated commercial, performance, or certification claims", () => {
    const publicCopy = JSON.stringify(vidyaLumaProduct).toLowerCase();
    expect(publicCopy).not.toContain("trusted by");
    expect(publicCopy).not.toContain("certified");
    expect(publicCopy).not.toContain("#1");
    expect(publicCopy).not.toContain("100%");
  });
});