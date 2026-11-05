import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crawlerPolicy, isPublicSitemapPath, normalizePublicPath, privatePathPrefixes, searchCrawlerAgents } from "../lib/crawler-policy";
import { resolvePublicSiteUrl } from "../lib/env/public";
import { buildPublicMetadata, serializeJsonLd } from "../lib/search-metadata";
import { buildPublicSitemap } from "../lib/search-sitemap";
import { companyFaqMarkdown, companyFaqs, discoveryProducts, discoveryTextResponse, llmsIndex } from "../lib/public-discovery";
import { publicSiteIdentity, publicWebsiteStructuredData } from "../lib/site";
import { contentMetadata } from "../lib/content/seo";
import type { PublicContentRecord } from "../lib/content/types";
import type { KraviaProduct } from "../lib/corporate-content";

const origin = "https://www.kraviaprivatelimited.com";
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const record = (overrides: Partial<PublicContentRecord> = {}): PublicContentRecord => ({ id: "public-news", type: "NEWS", slug: "example", title: "Example", body: "Public text", status: "PUBLISHED", visibility: "PUBLIC", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-02T00:00:00Z", version: 1, seo: { title: "Example", description: "A public update" }, ...overrides });

// The real legal resolver remains server-only and is exercised by the HTTP smoke test.
const legalRedirectFixture = (path: string) => path === "/trust/privacy" ? "/legal/privacy" : null;

describe("search identity and metadata", () => {
  it("declares a human brand name, not a URL, with the legal-name alternative", () => {
    expect(publicSiteIdentity).toEqual({ name: "KRAVIA", alternateName: "KRAVIA PRIVATE LIMITED" });
    expect(publicWebsiteStructuredData()).toMatchObject({ "@type": "WebSite", name: "KRAVIA", alternateName: "KRAVIA PRIVATE LIMITED", inLanguage: "en" });
  });
  it.each([undefined, "http://localhost:3000", "https://kraviaprivatelimited.com", "https://wrong.example", "javascript:alert(1)"])("pins production canonical identity for %s", (value) => {
    expect(resolvePublicSiteUrl(value, { VERCEL_ENV: "production" })).toBe(origin);
  });
  it("does not leak a production canonical into an unconfigured preview", () => {
    expect(resolvePublicSiteUrl(origin, { VERCEL_ENV: "preview" })).toBe("http://localhost:3000");
    expect(resolvePublicSiteUrl(origin, { VERCEL_ENV: "preview", VERCEL_URL: "kravia-preview.vercel.app" })).toBe("https://kravia-preview.vercel.app");
  });
  it.each(["/contact", "/support", "/company/faq"])("gives %s its own canonical and social identity", (path) => {
    const metadata = buildPublicMetadata({ title: "Page", description: "Description", path }, true);
    expect(metadata.alternates?.canonical).toEqual(expect.stringContaining(path));
    expect(metadata.openGraph).toMatchObject({ siteName: "KRAVIA", title: "Page | KRAVIA", url: expect.stringContaining(path) });
  });
  it("keeps explicit noindex, previews and private paths non-indexable", () => {
    for (const metadata of [buildPublicMetadata({ title: "Page", description: "", path: "/contact" }, false), buildPublicMetadata({ title: "Page", description: "", path: "/contact", noindex: true }, true), buildPublicMetadata({ title: "Page", description: "", path: "/office/login" }, true)]) expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(contentMetadata(record()).robots).toMatchObject({ index: false });
  });
  it("does not inherit a homepage canonical on every route", () => {
    expect(source("app/layout.tsx")).not.toContain('alternates: { canonical: "/" }');
    expect(source("app/(public)/page.tsx")).toContain('alternates: { canonical: "/" }');
    expect(source("app/(public)/contact/page.tsx")).toContain('path: "/contact"');
    expect(source("app/(public)/support/page.tsx")).toContain('path: "/support"');
  });
  it("safely serializes JSON-LD without permitting a closing script tag", () => {
    const data = { title: "</script><script>alert(1)</script>" };
    const encoded = serializeJsonLd(data);
    expect(encoded).not.toContain("<");
    expect(JSON.parse(encoded)).toEqual(data);
  });
});

describe("crawler and sitemap boundaries", () => {
  it("repeats the private boundary for every search-agent group", () => {
    const policy = crawlerPolicy(true, origin);
    expect(policy.rules).toEqual([...searchCrawlerAgents, "*"].map((userAgent) => ({ userAgent, allow: "/", disallow: [...privatePathPrefixes] })));
    expect(crawlerPolicy(false, origin).rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });
  it.each(["https://external.example/path", "//external.example", "/office/login", "/%61dmin", "/legal/preview/policy", "/public/../office", "/public/%2e%2e/office", "/public%2foffice", "/public%5coffice", "/public%252foffice", "/contact?email=private", "/contact#private", "/bad%", "/bad%0a", " contact"])("excludes unsafe or private path %s", (path) => {
    expect(isPublicSitemapPath(path)).toBe(false);
  });
  it("normalizes safe paths before deduplication", () => {
    expect(normalizePublicPath("company/about/")).toBe("/company/about");
    expect(buildPublicSitemap(["/", "", "products/vidyaluma", "/products/vidyaluma/"], [], origin).map((item) => item.url)).toEqual([`${origin}/`, `${origin}/products/vidyaluma`]);
  });
  it("excludes redirect sources and retains their public destinations once", () => {
    const urls = buildPublicSitemap(["/trust/privacy", "/legal/privacy", "/products/recruitflow", "/products/nicerole"], [], origin, legalRedirectFixture).map((item) => item.url);
    expect(urls).toEqual([`${origin}/legal/privacy`, `${origin}/products/nicerole`]);
    expect(source("app/sitemap.ts")).toContain("siteUrl, staticLegalRedirect");
  });
  it("rejects private or external destinations from a redirect resolver", () => {
    expect(buildPublicSitemap(["/company"], [], origin, () => "/office/private")).toEqual([]);
    expect(buildPublicSitemap(["/company"], [], origin, () => "https://external.example/path")).toEqual([]);
  });
  it("gives a published noindex record precedence over a static entry", () => {
    const hidden = record({ seo: { title: "", description: "", canonicalPath: "/company/about", noindex: true } });
    expect(buildPublicSitemap(["/company/about"], [hidden], origin)).toEqual([]);
  });
  it("excludes private, draft and external-canonical records", () => {
    expect(buildPublicSitemap([], [record({ visibility: "PRIVATE" }), record({ status: "DRAFT" }), record({ seo: { title: "", description: "", canonicalPath: "https://external.example" } })], origin)).toEqual([]);
  });
  it("uses actual modification dates and does not invent dates for static URLs", () => {
    const entries = buildPublicSitemap(["/contact", "/newsroom/example"], [record()], origin);
    expect(entries).toEqual([{ url: `${origin}/contact` }, { url: `${origin}/newsroom/example`, lastModified: "2026-07-02T00:00:00.000Z" }]);
    expect(buildPublicSitemap([], [record({ updatedAt: "invalid" })], origin)[0]).not.toHaveProperty("lastModified");
  });
});

describe("public answer and machine-readable surfaces", () => {
  it("publishes the same answers in the visible page and Markdown", () => {
    const markdown = companyFaqMarkdown();
    for (const item of companyFaqs()) { expect(markdown).toContain(item.question); expect(markdown).toContain(item.answer); }
    expect(source("app/company/faq/page.tsx")).toContain("const questions = companyFaqs()");
    expect(source("app/company/faq/page.tsx")).toContain("text: item.answer");
  });
  it("links the FAQ and discovery guide without altering the company logo", () => {
    expect(source("components/footer.tsx")).toContain('["Company FAQ", "/company/faq"]');
    expect(source("components/footer.tsx")).toContain("<BrandLogo inverse animated />");
    expect(source("app/layout.tsx")).toContain('rel="describedby" href="/llms.txt"');
    expect(llmsIndex()).toContain("/company/faq.md");
  });
  it("projects only public product fields and preserves availability caveats", () => {
    const product: KraviaProduct = { id: "test", slug: "test", name: "Test", category: "Software", description: "Public description", status: "COMING_SOON", public: true, href: "/products/test", order: 1 };
    expect(discoveryProducts([{ ...product, public: false }, { ...product, status: "PRIVATE" }, { ...product, href: "/office/private" }])).toEqual([]);
    expect(discoveryProducts([product])).toEqual([{ name: "Test", category: "Software", description: "Public description", status: "In development / coming soon", href: "/products/test" }]);
    expect(companyFaqMarkdown()).toContain("not a claim of general availability");
  });
  it("does not export private route links or certificate identifiers", () => {
    for (const body of [llmsIndex(), companyFaqMarkdown()]) {
      expect(body).not.toMatch(/https?:\/\/[^\s)]+\/(office|admin|api|auth|finance|corporate|privacy-request)(?:[\/\s)]|$)/);
      expect(body).not.toContain("AANCK0043M");
    }
  });
  it("returns real text with preview noindex and matching canonical headers", async () => {
    const preview = discoveryTextResponse(companyFaqMarkdown(), "/company/faq", true, false);
    expect(preview.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(preview.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(preview.headers.get("cache-control")).toBe("no-store");
    expect(preview.headers.get("link")).toContain('/company/faq>; rel="canonical"');
    expect(await preview.text()).toContain("# KRAVIA");
    expect(discoveryTextResponse(llmsIndex(), "/llms.txt", false, true).headers.get("x-robots-tag")).toBeNull();
  });
});
