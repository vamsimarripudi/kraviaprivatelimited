import { describe, expect, it } from "vitest";
import { crawlerPolicy, isPublicSitemapPath, privatePathPrefixes, publicPageRobots } from "../lib/crawler-policy";
import { companyProfile, publicPages, publicSiteIdentity, publicWebsiteStructuredData } from "../lib/site";

describe("public company data", () => {
  it("publishes the verified statutory identity used for company discovery", () => {
    expect(companyProfile.cin).toBe("U62011AP2026PTC126691");
    expect(companyProfile.gst.gstin).toBe("37AANCK0043M1ZA");
    expect(companyProfile.corporateEmail).toBe("hello@kraviaprivatelimited.com");
    expect(companyProfile.website).toBeNull();
  });

  it("keeps required public route content available", () => {
    expect(Object.keys(publicPages)).toEqual(expect.arrayContaining(["company", "products", "governance", "disclosures", "trust/data-protection"]));
  });

  it("declares the approved human-readable site name for search", () => {
    expect(publicSiteIdentity).toEqual({ name: "Kravia Private Limited", alternateName: "Kravia" });
    expect(publicWebsiteStructuredData()).toMatchObject({
      "@type": "WebSite",
      name: "Kravia Private Limited",
      alternateName: "Kravia",
      url: expect.stringMatching(/^https?:\/\//),
    });
  });
});

describe("canonical URL resolution", () => {
  it("uses the apex Vercel production canonical URL when a localhost value leaks into production", async () => {
    const { resolvePublicSiteUrl } = await import("../lib/env/public");
    expect(resolvePublicSiteUrl("http://localhost:3000", { VERCEL_ENV: "production" })).toBe("https://kraviaprivatelimited.com");
  });

  it("uses the preview host instead of a shared production canonical", async () => {
    const { resolvePublicSiteUrl } = await import("../lib/env/public");
    expect(resolvePublicSiteUrl("https://kraviaprivatelimited.com", { VERCEL_ENV: "preview", VERCEL_URL: "kravia-preview.vercel.app" })).toBe("https://kravia-preview.vercel.app");
  });
});

describe("public crawler boundaries", () => {
  it("allows public crawling while explicitly disallowing private route families", () => {
    const policy = crawlerPolicy(true, "https://kraviaprivatelimited.com");
    expect(policy.rules).toEqual([
      { userAgent: "OAI-SearchBot", allow: "/", disallow: [...privatePathPrefixes] },
      { userAgent: "ChatGPT-User", allow: "/", disallow: [...privatePathPrefixes] },
      { userAgent: "*", allow: "/", disallow: [...privatePathPrefixes] },
    ]);
    expect(policy.sitemap).toBe("https://kraviaprivatelimited.com/sitemap.xml");
  });

  it("blocks preview indexing without advertising private routes", () => {
    expect(crawlerPolicy(false, "https://preview.example.vercel.app").rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("applies noindex metadata to previews as defense in depth", () => {
    expect(publicPageRobots(true)).toEqual({ index: true, follow: true });
    expect(publicPageRobots(false)).toEqual({ index: false, follow: false, nocache: true });
  });

  it("allows only public route families into sitemap generation", () => {
    expect(["/", "/company", "/products/vidyaluma", "/trust/security", "/newsroom/example"].every(isPublicSitemapPath)).toBe(true);
    expect([
      "/corporate",
      "/corporate/documents/a",
      "/office",
      "/office/dashboard",
      "/office/login",
      "/finance",
      "/finance/gst",
      "/finance/login",
      "/admin",
      "/api/support",
      "/auth/callback",
      "/privacy-request",
    ].every((path) => !isPublicSitemapPath(path))).toBe(true);
  });
});
