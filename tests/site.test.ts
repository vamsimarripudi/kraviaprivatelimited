import { describe, expect, it } from "vitest";
import { crawlerPolicy, isPublicSitemapPath } from "../lib/crawler-policy";
import { companyProfile, publicPages } from "../lib/site";

describe("public company data", () => {
  it("does not manufacture statutory identifiers", () => {
    expect(companyProfile.cin).toBeNull();
    expect(companyProfile.gst.gstin).toBeNull();
  });

  it("keeps required public route content available", () => {
    expect(Object.keys(publicPages)).toEqual(expect.arrayContaining(["company", "products", "governance", "disclosures", "trust/data-protection"]));
  });
});

describe("public crawler boundaries", () => {
  it("allows ordinary public crawling only for production and publishes one sitemap", () => {
    const policy = crawlerPolicy(true, "https://www.kraviaprivatelimited.com");
    expect(policy.rules).toEqual([{ userAgent: "*", allow: "/" }]);
    expect(policy.sitemap).toBe("https://www.kraviaprivatelimited.com/sitemap.xml");
  });

  it("blocks preview indexing without advertising private routes", () => {
    expect(crawlerPolicy(false, "https://preview.example.vercel.app").rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("allows only public route families into sitemap generation", () => {
    expect(["/", "/company", "/products/vidyaluma", "/trust/security", "/newsroom/example"].every(isPublicSitemapPath)).toBe(true);
    expect(["/corporate", "/corporate/documents/a", "/admin", "/api/support", "/auth/callback", "/privacy-request"].every((path) => !isPublicSitemapPath(path))).toBe(true);
  });
});