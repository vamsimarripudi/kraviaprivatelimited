import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { kraviaNextChapterNewsroomRecord } from "../lib/corporate/next-chapter-news";
import { contentPath } from "../lib/content/seo";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("KRAVIA next chapter website update", () => {
  it("publishes a factual company-owned Newsroom announcement", () => {
    const record = kraviaNextChapterNewsroomRecord;
    expect(record.type).toBe("NEWS");
    expect(record.status).toBe("PUBLISHED");
    expect(record.visibility).toBe("PUBLIC");
    expect(record.publishedAt).toBe("2026-11-20");
    expect(contentPath(record)).toBe("/newsroom/kravia-new-chapter-building-technology-products");
    expect(record.seo.canonicalPath).toBe("/newsroom/kravia-new-chapter-building-technology-products");
    expect(JSON.stringify(record.body)).toContain("VidyaLuma");
    expect(JSON.stringify(record.body)).toContain("NVIDIA Inception");
    expect(JSON.stringify(record.body)).not.toMatch(/\bAWS\b|Activate|10,000|Amazon Web Services/i);
  });

  it("reuses the approved KRAVIA brand asset without changing it", () => {
    expect(source("public/brand/kravia-enterprise-v2.svg")).toContain('id="kravia-svg"');
    const component = source("components/newsroom-content.tsx");
    expect(component).toContain('article.slug === kraviaNextChapterNewsroomRecord.slug');
    expect(component).toContain('src="/brand/kravia-enterprise-v2.svg"');
    expect(component).toContain("article-kravia-identity");
  });

  it("flows into the existing homepage, newsroom, RSS, sitemap and article routes", () => {
    const repository = source("lib/content/repository.ts");
    expect(repository).toContain("kraviaNextChapterNewsroomRecord");
    expect(repository).toContain("byPath.set(publicContentPath(record), record)");
    expect(source("components/newsroom-content.tsx")).toContain("export function HomepageUpdates");
    expect(source("app/(public)/page.tsx")).toContain("getPublishedNewsroomContent");
    expect(source("app/newsroom/rss.xml/route.ts")).toContain("getPublishedNewsroomContent");
    expect(source("app/sitemap.ts")).toContain("await listPublishedContent()");
    expect(source("app/(public)/[...segments]/page.tsx")).toContain("getPublishedContentByPublicPath");
  });
});
