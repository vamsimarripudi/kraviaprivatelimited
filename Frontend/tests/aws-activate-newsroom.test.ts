import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { awsActivateAward, awsActivateNewsroomRecord } from "../lib/corporate/aws-activate-award";
import { contentPath } from "../lib/content/seo";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("AWS Activate newsroom milestone", () => {
  it("uses the exact owner-approved image with the correct KRAVIA logo", () => {
    expect(awsActivateAward.artwork).toBe("/newsroom/kravia-aws-activate-credits.jpg");
    const bytes = readFileSync(resolve(process.cwd(), "public", awsActivateAward.artwork.slice(1)));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("90e528749f83773809af2fa4dab9dd43dd1a286157e1ab0ba4fba8dd4b81b7f0");
  });

  it("accurately records the award, expiry and no partnership claims", () => {
    const a = awsActivateNewsroomRecord;
    expect(awsActivateAward.amountUsd).toBe(10000);
    expect(awsActivateAward.expiresAt).toBe("2028-11-30");
    expect(a.type).toBe("NEWS");
    expect(a.status).toBe("PUBLISHED");
    expect(a.visibility).toBe("PUBLIC");
    expect(contentPath(a)).toBe("/newsroom/kravia-aws-activate-credits");
    expect(a.seo.canonicalPath).toBe("/newsroom/kravia-aws-activate-credits");
    expect(a.seo.ogImage).toBe(awsActivateAward.artwork);
    expect(JSON.stringify(a.body)).toContain("VidyaLuma");
    expect(JSON.stringify(a.body)).toContain("not cash financing");
    expect(JSON.stringify(a.body)).toContain("30 November 2028");
    expect(awsActivateAward.disclaimer).toContain("not an equity investment");
  });

  it("uses existing governance and adds the image to the newsroom feature and story", () => {
    expect(source("lib/content/repository.ts")).toContain("awsActivateNewsroomRecord");
    expect(source("lib/content/repository.ts")).toContain("byPath.set(publicContentPath(record), record)");
    const newsroom = source("components/newsroom-content.tsx");
    expect(newsroom).toContain("featured.slug === awsActivateNewsroomRecord.slug");
    expect(newsroom).toContain('article.slug === awsActivateNewsroomRecord.slug');
    expect(newsroom).toContain("article-award-visual");
    expect(source("app/newsroom/rss.xml/route.ts")).toContain("getPublishedNewsroomContent");
    expect(source("app/sitemap.ts")).toContain("await listPublishedContent()");
  });
});
