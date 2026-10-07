import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLegalPolicyMarkdown } from "../lib/legal/policy-markdown";

type ReleasedPolicy = {
  id: string;
  title: string;
  slug: string;
  effectiveDate: string;
  contentSha256: string;
  body: string;
};

const release = JSON.parse(readFileSync(new URL("../data/legal/public-policy-release-v1.json", import.meta.url), "utf8")) as {
  format: string;
  sourcePackVersion: string;
  documents: ReleasedPolicy[];
};

describe("KRAVIA public legal v1 release", () => {
  it("contains exactly the 26 P-series policy sources and no internal documents", () => {
    expect(release.format).toBe("KRAVIA_PUBLIC_LEGAL_RELEASE_V1");
    expect(release.sourcePackVersion).toBe("1.0");
    expect(release.documents).toHaveLength(26);
    expect(release.documents.map((document) => document.id)).toEqual(Array.from({ length: 26 }, (_, index) => `P${String(index + 1).padStart(2, "0")}`));
    expect(release.documents.every((document) => /^P\d{2}$/.test(document.id))).toBe(true);
  });

  it("keeps every rendered policy body hash-bound to its canonical release asset", () => {
    for (const document of release.documents) {
      expect(createHash("sha256").update(document.body, "utf8").digest("hex")).toBe(document.contentSha256);
      expect(parseLegalPolicyMarkdown(document.body)).not.toBeNull();
    }
  });

  it("preserves source tables as accessible document tables instead of rendering pipe-delimited text", () => {
    const privacy = release.documents.find((document) => document.id === "P02");
    const document = privacy ? parseLegalPolicyMarkdown(privacy.body) : null;
    expect(document?.sections.flatMap((section) => section.tables ?? []).length).toBeGreaterThan(0);
  });
});
