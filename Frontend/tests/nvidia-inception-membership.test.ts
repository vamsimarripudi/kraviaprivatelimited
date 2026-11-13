import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nvidiaInceptionMembership, nvidiaInceptionNewsroomRecord } from "../lib/corporate/program-memberships";
import { contentPath } from "../lib/content/seo";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("NVIDIA Inception company membership", () => {
  it("reuses the exact official RGB member badge supplied in the approval archive", () => {
    expect(nvidiaInceptionMembership.badge).toBe("/brand/partners/nvidia-inception-member-rgb.svg");
    const bytes = readFileSync(resolve(process.cwd(), "public", nvidiaInceptionMembership.badge.slice(1)));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("d2f1fc25616ba02933506b21fa668289169e58ac4c76b5f7f209f2632f289f2e");
    expect(source("components/footer.tsx")).toContain("/brand/partners/nvidia-inception-member-rgb.svg");
  });

  it("states the program membership but makes no NVIDIA investment or product endorsement claim", () => {
    expect(nvidiaInceptionMembership.program).toBe("NVIDIA Inception");
    expect(nvidiaInceptionMembership.status).toBe("Member");
    expect(nvidiaInceptionMembership.url).toBe("https://www.nvidia.com/en-in/startups/");
    expect(nvidiaInceptionMembership.disclaimer).toContain("does not mean NVIDIA has funded");
    expect(nvidiaInceptionMembership.disclaimer).toContain("endorsed");
    const page = source("components/public-page-content.tsx");
    expect(page).toContain("nvidiaInceptionMembership.description");
    expect(page).toContain("<CorporateRecognitions />");
    expect(source("lib/site.ts")).toContain("A member of NVIDIA Inception");
  });

  it("publishes the approved milestone as a Newsroom article, not a newsletter", () => {
    const news = nvidiaInceptionNewsroomRecord;
    expect(news.type).toBe("NEWS");
    expect(news.status).toBe("PUBLISHED");
    expect(news.visibility).toBe("PUBLIC");
    expect(news.authorName).toBe("KRAVIA PRIVATE LIMITED");
    expect(news.publishedAt).toBe("2026-11-13");
    expect(contentPath(news)).toBe("/newsroom/kravia-joins-nvidia-inception");
    expect(news.seo.canonicalPath).toBe("/newsroom/kravia-joins-nvidia-inception");
    expect(JSON.stringify(news.body)).toContain("VidyaLuma");
    expect(JSON.stringify(news.body)).toContain("does not mean NVIDIA has invested");
    const manager = source("components/public-newsletter-manager.tsx");
    expect(manager).not.toContain("nvidiaInceptionNewsletterDraft");
    expect(manager).not.toContain("Load NVIDIA Inception announcement");
    expect(source("lib/corporate/program-memberships.ts")).not.toContain("nvidiaInceptionNewsletterDraft");
  });

  it("reuses approved public publication plumbing for Newsroom, article, RSS and sitemap", () => {
    const repository = source("lib/content/repository.ts");
    const newsroom = source("components/newsroom-content.tsx");
    expect(repository).toContain("nvidiaInceptionNewsroomRecord");
    expect(repository).toContain('type !== "NEWS"');
    expect(repository).toContain("byPath.set(publicContentPath(record), record)");
    expect(newsroom).toContain("nvidiaInceptionNewsroomRecord.slug");
    expect(newsroom).toContain("nvidiaInceptionMembership.badge");
    expect(newsroom).toContain("article-inception-links");
    expect(source("app/newsroom/rss.xml/route.ts")).toContain("getPublishedNewsroomContent");
    expect(source("app/sitemap.ts")).toContain("await listPublishedContent()");
    expect(source("app/(public)/[...segments]/page.tsx")).toContain("getPublishedContentByPublicPath");
  });
});
