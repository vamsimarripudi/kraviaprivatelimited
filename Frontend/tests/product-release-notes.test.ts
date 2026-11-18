import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { filterProductReleaseNotes, productReleaseNotes, releaseNoteSearchText } from "../lib/products/release-notes";
import { escapeReleaseNotesXml, renderProductReleaseNotesRss } from "../lib/products/release-notes-feed";

function file(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("KRAVIA product release notes", () => {
  it("publishes one dated, reviewed VidyaLuma Connect development entry", () => {
    expect(productReleaseNotes).toHaveLength(1);
    const note = productReleaseNotes[0];
    expect(note.slug).toBe("vidyaluma-connect-development");
    expect(note.product).toBe("VidyaLuma");
    expect(note.publishedOn).toBe("2026-11-19");
    expect(note.sourceReviewedOn).toBe("2026-11-19");
    expect(note.type).toBe("Development");
    expect(note.releaseVerified).toBe(false);
    expect(note.built).toHaveLength(6);
    expect(note.beforeRelease.length).toBeGreaterThanOrEqual(5);
    expect(note.safeguards.join(" ")).toContain("server-readable");
    expect(note.availability.toLowerCase()).toContain("not been verified");
  });

  it("keeps general availability and beta claims evidence-gated", () => {
    expect(new Set(productReleaseNotes.map((note) => note.slug)).size).toBe(productReleaseNotes.length);
    for (const note of productReleaseNotes) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(note.publishedOn)).toBe(true);
      expect(Number.isFinite(Date.parse(note.publishedOn))).toBe(true);
      expect(note.references.every((ref) => ref.href.startsWith("https://vidyaluma.in"))).toBe(true);
      if (note.type === "General availability" || note.type === "Beta") expect(note.releaseVerified).toBe(true);
    }
  });

  it("filters, searches, and sorts against all of the public entry content", () => {
    expect(filterProductReleaseNotes()).toHaveLength(1);
    expect(filterProductReleaseNotes({ product: "VidyaLuma" })).toHaveLength(1);
    expect(filterProductReleaseNotes({ product: "YUKTA" })).toHaveLength(0);
    expect(filterProductReleaseNotes({ type: "Improvement" })).toHaveLength(0);
    expect(filterProductReleaseNotes({ type: "Development" })).toHaveLength(1);
    expect(filterProductReleaseNotes({ query: "attachment", sort: "oldest" })).toHaveLength(1);
    expect(filterProductReleaseNotes({ query: "NO_SUCH_UPDATE" })).toHaveLength(0);
    expect(releaseNoteSearchText(productReleaseNotes[0])).toContain("school");
  });

  it("creates a valid RSS XML envelope with canonical deep links and escaped copy", () => {
    const xml = renderProductReleaseNotesRss("https://kraviaprivatelimited.com");
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("https://kraviaprivatelimited.com/products/release-notes#vidyaluma-connect-development");
    expect(xml).toContain("<category>Development</category>");
    expect(xml).toContain("2026");
    expect(escapeReleaseNotesXml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
    expect(xml).not.toContain("github.com/vamsimarripudi/vidyaluma-platform");
  });

  it("is discoverable through product navigation, sitemap, and RSS", () => {
    const route = file("app/(public)/products/release-notes/page.tsx");
    const view = file("components/product-release-notes.tsx");
    const footer = file("components/footer.tsx");
    const sitemap = file("app/sitemap.ts");
    const rss = file("app/(public)/products/release-notes/rss.xml/route.ts");
    const product = file("components/vidyaluma-product-page.tsx");
    expect(route).toContain('canonical: "/products/release-notes"');
    expect(view).toContain("filterProductReleaseNotes");
    expect(view).toContain('id={note.slug}');
    expect(view).toContain('aria-live="polite"');
    expect(footer).toContain('["Product release notes", "/products/release-notes"]');
    expect(sitemap).toContain('"/products/release-notes"');
    expect(rss).toContain("application/rss+xml");
    expect(product).toContain("/products/release-notes#vidyaluma-connect-development");
  });
});
