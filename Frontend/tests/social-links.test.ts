import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { publicCompanyLinks, publicSocialProfiles } from "../lib/public-links";
import { createArticleShareLinks } from "../lib/social-sharing";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const component = read("components/social-links.tsx");
const css = read("components/social-links.module.css");

const expectedProfiles = [
  "https://www.facebook.com/profile.php?id=61595906774125",
  "https://www.instagram.com/kravia_private_limited/",
  "https://x.com/KraviaOfficial",
  "https://linkedin.com/company/kravia-private-limited",
];

describe("official corporate social links", () => {
  it("keeps exactly the four owner-provided destinations in one registry", () => {
    expect(Object.values(publicCompanyLinks)).toEqual(expectedProfiles);
    expect(publicSocialProfiles.map((profile) => profile.href)).toEqual(expectedProfiles);
    expect(new Set(publicSocialProfiles.map((profile) => profile.key)).size).toBe(4);
  });

  it.each(publicSocialProfiles)("uses HTTPS for $label without tracking parameters", ({ href }) => {
    const url = new URL(href);
    expect(url.protocol).toBe("https:");
    expect([...url.searchParams.keys()].every((key) => key === "id")).toBe(true);
  });

  it("preserves the required Facebook page identifier", () => {
    expect(new URL(publicCompanyLinks.facebook).searchParams.get("id")).toBe("61595906774125");
  });

  it("protects new-tab links and provides accessible destination labels", () => {
    expect(component).toContain('target="_blank" rel="noopener noreferrer"');
    expect(component).toContain('aria-label={`KRAVIA on ${profile.label} (opens in a new tab)`}');
    expect(read("components/social-icon.tsx")).toContain('aria-hidden="true" focusable="false"');
    expect(component).not.toContain('"use client"');
    expect(component).not.toMatch(/<iframe|<script|window\.open/);
  });

  it("provides touch targets, keyboard focus and reduced-motion styling", () => {
    expect(css).toContain("min-width: 48px");
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("covers the footer, Contact, About and Careers without changing the company logo", () => {
    const footer = read("components/footer.tsx");
    const pages = read("app/(public)/[...segments]/page.tsx");
    expect(footer).toContain("<SocialLinks inverse />");
    expect(footer).toContain("<BrandLogo inverse animated />");
    expect(read("app/(public)/contact/page.tsx")).toContain('<SocialConnect context="contact" />');
    expect(pages).toContain('<SocialConnect context="about" />');
    expect(pages).toContain('<SocialConnect context="careers" />');
    expect(pages.match(/\{socialSection\}/g)).toHaveLength(2);
    expect(component).toContain('context === "careers" ? ["linkedIn"] : undefined');
  });

  it("uses the same registry for organization identity", () => {
    expect(read("components/structured-data.tsx")).toContain("sameAs: publicSocialProfiles.map((profile) => profile.href)");
  });
});

describe("article sharing", () => {
  const url = "https://www.kraviaprivatelimited.com/newsroom/product-update?a=1&b=two";
  const title = "KRAVIA & VidyaLuma: a new chapter #1";

  it("encodes article URLs and titles without pointing to follow destinations", () => {
    const links = createArticleShareLinks(url, title);
    expect(links.map((link) => link.key)).toEqual(["facebook", "x", "linkedIn"]);
    expect(new URL(links[0].href).searchParams.get("u")).toBe(url);
    expect(new URL(links[1].href).searchParams.get("url")).toBe(url);
    expect(new URL(links[1].href).searchParams.get("text")).toBe(title);
    expect(new URL(links[2].href).searchParams.get("url")).toBe(url);
    for (const link of links) expect(expectedProfiles).not.toContain(link.href);
  });

  it.each(["javascript:alert(1)", "data:text/plain,test", "file:///tmp/article"])("rejects non-web URL %s", (url) => {
    expect(() => createArticleShareLinks(url, title)).toThrow(TypeError);
  });

  it("uses the governed canonical article path and retains the existing copy action", () => {
    const article = read("components/newsroom-content.tsx");
    expect(article).toContain("new URL(publicContentPath(article), siteUrl).toString()");
    expect(article).toContain('<CopyLinkButton label="Copy link" />');
    expect(article).toContain("shareable && <ArticleShareLinks");
  });
});
