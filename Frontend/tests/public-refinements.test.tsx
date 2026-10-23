import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeadershipContent, LeadershipPreview } from "../components/leadership/leadership-content";
import { defaultProfileImage, leadershipJsonLd, teamProfiles } from "../lib/leadership";
import { publicCompanyLinks } from "../lib/public-links";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public profiles and compact site typography", () => {
  it("routes Vamsi's portrait, name and portfolio CTA to his supplied site", () => {
    const html = renderToStaticMarkup(<LeadershipContent />);
    expect(html.match(/href="https:\/\/vamsimarripudi.me"/g)).toHaveLength(3);
    expect(html).toContain('class=');
    expect(renderToStaticMarkup(<LeadershipPreview />)).toContain('href="https://vamsimarripudi.me"');
  });

  it("uses the exact professional and company URLs supplied by the owner", () => {
    expect(teamProfiles[0].linkedIn).toBe("https://www.linkedin.com/in/vamsimarripudi");
    expect(teamProfiles[1].linkedIn).toBe("https://www.linkedin.com/in/satish-manohar-9699a2253/");
    expect(teamProfiles[2].linkedIn).toBeNull();
    expect(publicCompanyLinks.linkedIn).toBe("https://linkedin.com/company/kravia-private-limited");
    const html = renderToStaticMarkup(<LeadershipContent />);
    expect(html).toContain(`href="${teamProfiles[0].linkedIn}"`);
    expect(html).toContain(`href="${teamProfiles[1].linkedIn}"`);
    expect(source("components/footer.tsx")).toContain("href={publicCompanyLinks.linkedIn}");
    expect(source("components/structured-data.tsx")).toContain("sameAs: [publicCompanyLinks.linkedIn]");
  });

  it("uses the supplied image for all missing portraits and removes initial-letter panels", () => {
    const html = renderToStaticMarkup(<LeadershipContent />);
    expect(html.match(/data-media-state="default"/g)).toHaveLength(3);
    for (const initials of ["VM", "SP", "JM"]) expect(html).not.toContain(`>${initials}</span>`);
    const path = resolve(process.cwd(), "public", defaultProfileImage.src.slice(1));
    expect(existsSync(path)).toBe(true);
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe("ea942be18e2b75c2c8fe02c6ce42a25ff0c56db663ac35ea84fe2144592a085c");
  });

  it("does not misrepresent the neutral avatar as a real portrait in search data", () => {
    const graph = leadershipJsonLd("https://www.kraviaprivatelimited.com")["@graph"];
    expect(JSON.stringify(graph)).not.toContain(defaultProfileImage.src);
    expect(graph.find((entry) => entry["@type"] === "Person" && "name" in entry && entry.name === "Vamsi Marripudi")).toHaveProperty("sameAs", [teamProfiles[0].linkedIn, teamProfiles[0].portfolio]);
  });

  it("uses medium circular portraits with a smaller mobile size and compact previews", () => {
    const css = source("components/leadership/leadership.module.css");
    expect(css).toContain("width: 128px; height: 128px;");
    expect(css).toContain("width: 104px; height: 104px;");
    expect(css).toContain("width: 48px; height: 48px;");
    expect(css).toContain("border-radius: 50%");
    expect(css).not.toContain(".initials");
    expect(css).not.toContain(".portraitWrap");
  });

  it("scopes shared typography to public screens without scaling the root or controls", () => {
    const css = source("app/public-typography.css");
    expect(source("app/layout.tsx")).toContain('import "./public-typography.css"');
    expect(css).toContain("@media screen");
    expect(css).toContain("body:has(.nav-wrap) .hero h1");
    expect(css).toContain("clamp(2.25rem,5.25vw,5.1rem)");
    expect(css).not.toMatch(/font-size:\s*(?:75%|12px)/);
    expect(css).not.toContain("zoom:");
    for (const name of ["legal-document", "legal-trust-center", "recruitflow-product-page", "yukta-research", "vorio-market-chart"]) {
      expect(source(`components/${name}.module.css`)).toContain("PUBLIC TYPOGRAPHY");
    }
  });
});
