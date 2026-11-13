import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nvidiaInceptionMembership, nvidiaInceptionNewsletterDraft } from "../lib/corporate/program-memberships";

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

  it("prepares a private owner newsletter without automatic approval or delivery", () => {
    expect(nvidiaInceptionNewsletterDraft.subject).toBe("KRAVIA joins NVIDIA Inception");
    expect(nvidiaInceptionNewsletterDraft.body).toContain("KRAVIA PRIVATE LIMITED is now a member");
    expect(nvidiaInceptionNewsletterDraft.body).toContain("does not represent NVIDIA investment");
    expect(nvidiaInceptionNewsletterDraft.body).toContain("https://www.kraviaprivatelimited.com/company/startup-profile");
    const manager = source("components/public-newsletter-manager.tsx");
    expect(manager).toContain("Load NVIDIA Inception announcement");
    expect(manager).toContain("setSubject(nvidiaInceptionNewsletterDraft.subject)");
    expect(manager).toContain("setBody(nvidiaInceptionNewsletterDraft.body)");
    expect(manager).toContain("Approval and sending are separate actions");
    expect(manager).toContain('onClick={loadInceptionDraft}');
    expect(source("app/office/newsletters/page.tsx")).toContain('identity.roles.includes("OWNER")');
  });
});
