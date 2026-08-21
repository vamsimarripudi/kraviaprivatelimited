import { describe, expect, it } from "vitest";
import { canTransitionContent, findHighRiskClaims, hasRequiredApprovals, isPublishable, requiredReviewDomains, validateSeo } from "../lib/content/governance";
import { contentPath, publicContentPath } from "../lib/content/seo";
import { canReviewContentDomain } from "../lib/corporate/permissions";
import { relatedContent, uniquePublicRelationships } from "../lib/content/relationships";
import { publicContentForHub } from "../lib/content/hubs";
import type { PublicContentRecord } from "../lib/content/types";

const base = { id: "test", type: "NEWS", slug: "real-update", title: "A verified update", summary: "A suitable description for a governed public content record.", body: ["Body"], status: "IN_REVIEW", visibility: "PRIVATE", createdAt: "2026-08-14T00:00:00.000Z", updatedAt: "2026-08-14T00:00:00.000Z", version: 1, seo: { title: "A verified update | Kravia", description: "A suitable description for a governed public content record.", canonicalPath: "/newsroom/real-update" } } satisfies PublicContentRecord;

describe("content governance", () => {
  it("flags rather than silently accepts high-risk public claims", () => { expect(findHighRiskClaims("We are 100% secure and fully compliant.").map(({ phrase }) => phrase.toLowerCase())).toEqual(expect.arrayContaining(["100%", "fully compliant"])); });
  it("requires review before content can be approved", () => { expect(hasRequiredApprovals(base, [])).toBe(false); expect(hasRequiredApprovals(base, [{ id: "r", contentId: "test", version: 1, domain: "CONTENT", status: "APPROVED" }])).toBe(true); });
  it("allows only controlled lifecycle transitions", () => { expect(canTransitionContent("DRAFT", "IN_REVIEW")).toBe(true); expect(canTransitionContent("DRAFT", "PUBLISHED")).toBe(false); });
  it("limits specialist review decisions to their assigned governance domain", () => {
    expect(canReviewContentDomain("PRIVACY_REVIEWER", "PRIVACY")).toBe(true);
    expect(canReviewContentDomain("PRIVACY_REVIEWER", "LEGAL")).toBe(false);
    expect(canReviewContentDomain("LEGAL_REVIEWER", "LEGAL")).toBe(true);
    expect(canReviewContentDomain("PRODUCT_REVIEWER", "SECURITY")).toBe(false);
  });
  it("rejects publication when SEO has an error", () => { expect(isPublishable({ ...base, slug: "Invalid slug" }, [{ id: "r", contentId: "test", version: 1, domain: "CONTENT", status: "APPROVED" }])).toBe(false); expect(validateSeo({ ...base, slug: "valid", seo: { ...base.seo, title: "" } }).some((issue) => issue.code === "MISSING_TITLE")).toBe(true); });
  it("adds specialist review domains only where content needs them", () => { expect(requiredReviewDomains("POLICY", { ...base, title: "Privacy policy" })).toEqual(expect.arrayContaining(["CONTENT", "CORPORATE", "LEGAL"])); });
  it("keeps the public knowledge graph de-duplicated and excludes private relationships", () => { expect(uniquePublicRelationships([{ fromId: "kravia", predicate: "BUILDS", toId: "vidyaluma", public: true }, { fromId: "kravia", predicate: "BUILDS", toId: "vidyaluma", public: true }, { fromId: "kravia", predicate: "HAS_ROLE", toId: "private", public: false }])).toHaveLength(1); });
  it("uses a simple, explainable related-content score", () => { const published: PublicContentRecord = { ...base, id: "related", status: "PUBLISHED", visibility: "PUBLIC", category: "Company" }; const source: PublicContentRecord = { ...published, id: "source", relatedEntityIds: ["vidyaluma"] }; expect(relatedContent(source, [published]).map((record) => record.id)).toEqual(["related"]); });
  it("places approved records on their governed public hub only", () => {
    const product: PublicContentRecord = { ...base, id: "product", type: "PRODUCT", slug: "vidyaluma", status: "PUBLISHED", visibility: "PUBLIC" };
    const trust: PublicContentRecord = { ...base, id: "trust", type: "TRUST_DOCUMENT", slug: "security", status: "PUBLISHED", visibility: "PUBLIC" };
    expect(publicContentForHub("products", [product, trust]).map((record) => record.id)).toEqual(["product"]);
    expect(publicContentForHub("trust", [product, trust]).map((record) => record.id)).toEqual(["trust"]);
    expect(publicContentForHub("unknown", [product, trust])).toEqual([]);
  });
  it("assigns stable routes by governed content type and honours approved canonicals", () => {
    expect(contentPath({ type: "PRODUCT", slug: "vidyaluma" })).toBe("/products/vidyaluma");
    expect(contentPath({ type: "TRUST_DOCUMENT", slug: "security-practices" })).toBe("/trust/security-practices");
    expect(contentPath({ type: "CORPORATE_DISCLOSURE", slug: "annual-return" })).toBe("/disclosures/annual-return");
    expect(publicContentPath({ ...base, type: "NEWS", seo: { ...base.seo, canonicalPath: "/newsroom/canonical-update" } })).toBe("/newsroom/canonical-update");
  });
});
