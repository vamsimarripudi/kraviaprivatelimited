import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PublicCompanyProfile } from "../lib/corporate/public-facts";
import type { PublicPortfolioItem } from "../lib/content/portfolio";
import type { PublicContentRecord } from "../lib/content/types";

// React's synchronous SSR API cannot execute the async server component. Keep
// this seam narrow: the actual homepage, links, market and newsroom still render.
vi.mock("../components/product-portfolio", () => ({
  ProductPortfolio: ({ products }: { products: readonly PublicPortfolioItem[] }) =>
    <section data-testid="remaining-portfolio">{products.map((product) =>
      <a key={product.id} href={product.href}>{product.name}</a>)}</section>,
}));

// Vitest runs without Next's tsconfig alias resolver; forward aliases to the
// actual modules instead of substituting their data or rendering behavior.
vi.mock("@/lib/corporate-content", () => import("../lib/corporate-content"));
vi.mock("@/lib/site", () => import("../lib/site"));
vi.mock("@/lib/leadership", () => import("../lib/leadership"));
vi.mock("@/lib/products/portfolio-market", () => import("../lib/products/portfolio-market"));
vi.mock("@/components/premium-interactions", () => import("../components/premium-interactions"));
vi.mock("@/lib/content/relationships", () => import("../lib/content/relationships"));
vi.mock("@/lib/content/seo", () => import("../lib/content/seo"));
import { HomepageBody } from "../components/homepage-body";
import { companyNarrative } from "../lib/corporate-content";
import { leadershipAssets } from "../lib/leadership";
import { marketContextForProductHref } from "../lib/products/portfolio-market";
import { siteUrl } from "../lib/site";

const homepageBodyCss = readFileSync(resolve(process.cwd(), "components/homepage-body.module.css"), "utf8");

const profile: PublicCompanyProfile = {
  legalName: "Synthetic Product Company Limited", displayName: "Synthetic Company",
  companyType: "Private Limited Company", country: "Testland", incorporationDate: "2026-01-01",
  cin: "SYNTHETIC-CIN-001", registeredOffice: "1 Example Street, Test City",
  telephone: "+00 000 000 000", corporateEmail: "contact@example.test", grievanceContact: null,
  gst: { registered: null, gstin: null },
};
const product = (overrides: Partial<PublicPortfolioItem> = {}): PublicPortfolioItem => ({
  id: "synthetic-workbench", name: "Synthetic Workbench", category: "Synthetic product category",
  description: "A synthetic description for the reviewed product fixture.",
  href: "/products/synthetic-workbench", state: "COMING_SOON", ...overrides,
});
const article = (overrides: Partial<PublicContentRecord> = {}): PublicContentRecord => ({
  id: "synthetic-news-1", type: "NEWS", slug: "synthetic-company-update",
  title: "Synthetic company update", summary: "A synthetic reviewed announcement.", body: [],
  status: "PUBLISHED", visibility: "PUBLIC", createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z", publishedAt: "2026-01-02T00:00:00.000Z", version: 1,
  seo: { title: "Synthetic company update", description: "Synthetic news description." }, ...overrides,
});
const render = (options: { profile?: PublicCompanyProfile; products?: readonly PublicPortfolioItem[]; newsroom?: readonly PublicContentRecord[] } = {}) =>
  renderToStaticMarkup(<HomepageBody profile={options.profile ?? profile} products={options.products ?? []} newsroom={options.newsroom ?? []} />);
const escape = (value: string) => renderToStaticMarkup(<>{value}</>);
const section = (html: string, headingId: string) => {
  const match = html.match(new RegExp(`<section[^>]*aria-labelledby="${headingId}"[^>]*>([\\s\\S]*?)<\\/section>`));
  if (!match) throw new Error(`Expected section labelled by ${headingId}`);
  return match[1];
};

describe("homepage body content and publication boundaries", () => {
  it("preserves the approved company narrative, mission, vision and every principle", () => {
    const html = render();
    for (const text of [companyNarrative.summary, companyNarrative.purpose, companyNarrative.mission, companyNarrative.vision]) {
      expect(html).toContain(escape(text));
    }
    for (const [title, copy] of companyNarrative.principles) {
      expect(html).toContain(`<h3>${escape(title)}</h3>`);
      expect(html).toContain(escape(copy));
    }
    expect(html).not.toMatch(/<h1[ >]/);
    expect(html).toContain('data-revealed="true"');
    expect(html).not.toContain('data-revealed="false"');
  });

  it("keeps the build approach as six ordered, readable list items", () => {
    const method = section(render(), "method-title");
    const list = method.match(/<ol>([\s\S]*?)<\/ol>/)?.[1];
    expect(list).toBeDefined();
    expect(list!.match(/<li[ >]/g)).toHaveLength(6);
    const steps = [...list!.matchAll(/<h3>(.*?)<\/h3>/g)].map((match) => match[1]);
    expect(steps).toEqual(["Understand", "Design", "Engineer", "Protect", "Learn", "Improve"]);
    expect(list).not.toContain('href="#"');
  });

  it("retains the real company, engineering, governance, trust and corporate-information routes", () => {
    const html = render();
    for (const href of ["/company/about", "/technology/engineering", "/governance", "/trust", "/company/corporate-information"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('id="products"');
    expect(html).toContain('role="tablist" aria-label="Kravia capability areas"');
    expect(html).toContain('role="tabpanel"');
  });

  it("renders supplied corporate facts and excludes missing values rather than inventing replacements", () => {
    const html = render();
    const corporate = section(html, "corporate-information-title");
    for (const value of [profile.legalName!, profile.companyType!, profile.country!, profile.cin!, profile.registeredOffice!, profile.corporateEmail!, profile.telephone!, siteUrl]) {
      expect(corporate).toContain(escape(value));
    }
    const sparse: PublicCompanyProfile = { ...profile, legalName: null, country: null, companyType: null,
      cin: null, registeredOffice: null, corporateEmail: null, telephone: null };
    const sparseHtml = render({ profile: sparse });
    const sparseCorporate = section(sparseHtml, "corporate-information-title");
    for (const label of ["Legal name", "Entity type", "Country", "CIN", "Registered office", "Email", "Telephone"]) {
      expect(sparseCorporate).not.toContain(`<dt>${label}</dt>`);
    }
    expect(sparseCorporate).toContain("<dt>Official website</dt>");
    expect(sparseCorporate).not.toContain(">null<");
    expect(sparseCorporate).not.toContain(">undefined<");
    const glance = section(sparseHtml, "glance-title");
    expect(glance).not.toContain("<dt>Identity</dt>");
    expect(glance).not.toContain("<dt>Base</dt>");
  });

  it("omits unpublished product and newsroom sections when no entries are supplied", () => {
    const html = render();
    expect(section(html, "glance-title")).not.toContain("<dt>Flagship product</dt>");
    expect(html).not.toContain('data-testid="remaining-portfolio"');
    expect(html).not.toContain('id="homepage-updates-title"');
    expect(html).not.toContain('id="portfolio-market-title"');
    expect(html).not.toContain("vidyaluma-logo.png");
    expect(html).not.toContain('href="/products/synthetic-workbench"');
  });

  it.each([
    ["ACTIVE", "Available"], ["BETA", "Beta"], ["COMING_SOON", "In development"], ["PUBLIC_PROFILE", "Public profile"],
  ] as const)("uses the supplied %s product state without implying a more advanced release", (state, expectedLabel) => {
    const item = product({ state });
    const html = render({ products: [item] });
    expect(html).toContain(`<h3>${item.name}</h3>`);
    expect(html).toContain(item.description);
    expect(html).toContain(`>${expectedLabel}</span>`);
    expect(html).toContain(`href="${item.href}"`);
    expect(html).toContain(`Explore ${item.name}`);
    expect(html).not.toContain('data-testid="remaining-portfolio"');
  });

  it("features the supplied first product and passes only remaining records to the portfolio", () => {
    const first = product();
    const second = product({ id: "synthetic-connector", name: "Synthetic Connector", href: "/products/synthetic-connector" });
    const third = product({ id: "synthetic-console", name: "Synthetic Console", href: "/products/synthetic-console" });
    const html = render({ products: [first, second, third] });
    const remaining = html.match(/<section data-testid="remaining-portfolio">([\s\S]*?)<\/section>/)?.[1];
    expect(remaining).toBeDefined();
    expect(remaining).not.toContain(first.name);
    for (const item of [second, third]) {
      expect(remaining).toContain(`href="${item.href}"`);
      expect(remaining).toContain(item.name);
    }
    expect(section(html, "glance-title")).toContain(`<dd>${first.name}</dd>`);
  });

  it("uses the approved logo only for a VidyaLuma feature and preserves its full alternative text", () => {
    const featured = product({ id: "vidyaluma", name: "Synthetic Learning Product", href: "/products/vidyaluma" });
    const html = render({ products: [featured] });
    const logo = leadershipAssets.vidyalumaLogo!;
    expect(html).toContain('alt="VidyaLuma — a product by Kravia"');
    expect(html).toContain(encodeURIComponent(logo.src));
    expect(html).toContain(`width="${logo.width}"`);
    expect(html).toContain(`height="${logo.height}"`);
    expect(html).toContain('href="/products/vidyaluma"');
    const other = render({ products: [product()] });
    expect(other).not.toContain("vidyaluma-logo.png");
    expect(other).not.toContain('alt="VidyaLuma — a product by Kravia"');
  });

  it("preserves reviewed market provenance by product href and keeps estimates distinct from company performance", () => {
    const reviewedHref = "/products/vidyaluma";
    const context = marketContextForProductHref(reviewedHref)!;
    const html = render({ products: [product({ href: reviewedHref })] });
    const market = section(html, "portfolio-market-title");
    expect(market).toContain("they are not Kravia revenue, valuation, customer counts or a promise of demand");
    expect(market).toContain(escape(context.scopeNote));
    expect(market).toContain(`href="${escape(context.sourceUrl)}"`);
    expect(market).toContain(`href="${reviewedHref}"`);
    expect(market).toContain(escape(context.sourceTitle));
    expect(market).toContain(`Research reviewed ${context.reviewedAt}`);
    expect(render({ products: [product()] })).not.toContain('id="portfolio-market-title"');
  });

  it("keeps the four-card market context compact and animates the comparison bars", () => {
    expect(homepageBodyCss).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(homepageBodyCss).toContain("animation: market-bar-reveal");
    expect(homepageBodyCss).toContain("@keyframes market-bar-reveal");
    expect(homepageBodyCss).toContain("prefers-reduced-motion: reduce");
  });

  it("renders supplied newsroom records with their governed canonical links", () => {
    const update = article({ seo: { title: "Synthetic update", description: "Synthetic summary", canonicalPath: "/newsroom/reviewed-synthetic-update" } });
    const html = render({ newsroom: [update] });
    const updates = section(html, "homepage-updates-title");
    expect(updates).toContain(update.title);
    expect(updates).toContain(update.summary!);
    expect(updates).toContain('href="/newsroom/reviewed-synthetic-update"');
    expect(updates).not.toContain('href="/newsroom/synthetic-company-update"');
    expect(updates).toContain('href="/newsroom"');
  });
});

