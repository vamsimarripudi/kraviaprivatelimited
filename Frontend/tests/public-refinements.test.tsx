import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeadershipContent, LeadershipPreview } from "../components/leadership/leadership-content";
import { leadershipJsonLd, leadershipPath, teamProfiles } from "../lib/leadership";
import { publicCompanyLinks } from "../lib/public-links";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const portraitHashes: Record<string, string> = {
  "jaya-satyanarayana-mangam": "6e1f0145226165a9bc14812eabf1724c8e4b0fd630cec12601db59076ee24565",
  "vamsi-marripudi": "a590b794bb76a36347ecbcb6a2ea4db66067ec29f3f9e84935e223f46bdae267",
  "satish-manohar-pennada": "5216a89d22f37364a0ae9b0a66e9fe43c3f25a606fe52c07a1b9510d2db81de5",
};
const expectedContributions: Record<string, string> = {
  "jaya-satyanarayana-mangam": "Documentation & Requirements",
  "vamsi-marripudi": "AI Engineering & Product Architecture",
  "satish-manohar-pennada": "Backend Engineering & VidyaLuma AI Tutor Design and Fulfilment",
};

describe("real leadership portraits and current contributions", () => {
  it("maps the first photo to Jaya, second to Vamsi and third to Satish", () => {
    expect(teamProfiles.map((person) => person.name)).toEqual([
      "Vamsi Marripudi", "Satish Manohar Pennada", "Jaya Satyanarayana Mangam",
    ]);
    expect(Object.keys(portraitHashes)).toEqual([
      "jaya-satyanarayana-mangam", "vamsi-marripudi", "satish-manohar-pennada",
    ]);
    for (const person of teamProfiles) {
      expect(person.portrait).toMatchObject({
        src: "/team/" + person.id + ".webp",
        width: 256,
        height: 256,
      });
      expect(person.contribution).toBe(expectedContributions[person.id]);
    }
  });

  it("ships intact, optimized 256-square WebP portraits", () => {
    for (const person of teamProfiles) {
      const imagePath = resolve(process.cwd(), "public", person.portrait!.src.slice(1));
      expect(existsSync(imagePath)).toBe(true);
      const bytes = readFileSync(imagePath);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
      expect(bytes.byteLength).toBeLessThan(25_000);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(portraitHashes[person.id]);
    }
  });

  it("renders three real profile images and clearly labelled current contributions", () => {
    const html = renderToStaticMarkup(<LeadershipContent />);
    expect(html.match(/data-media-state="image"/g)).toHaveLength(3);
    expect(html).not.toContain('data-media-state="default"');
    expect(html).toContain("Current contribution");
    for (const person of teamProfiles) {
      expect(html).toContain('alt="' + person.name + '"');
      expect(html).toContain(person.contribution.replaceAll("&", "&amp;"));
      expect(html).toContain(person.name);
    }
  });

  it("withholds all personal links and contact details, while retaining internal team navigation", () => {
    const html = renderToStaticMarkup(<LeadershipContent />);
    const preview = renderToStaticMarkup(<LeadershipPreview />);
    for (const person of teamProfiles) {
      expect(person.email).toBeNull();
      expect(person.linkedIn).toBeNull();
      expect(person.portfolio ?? null).toBeNull();
      expect(preview).toContain('href="' + leadershipPath + "#" + person.id + '"');
      expect(preview).toContain('alt="' + person.name + '"');
    }
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("tel:");
    expect(html).not.toContain("vamsimarripudi.me");
    expect(html).not.toContain("linkedin.com/in/");
    expect(preview).not.toContain("vamsimarripudi.me");
    expect(source("components/leadership/leadership-content.tsx")).not.toContain("profileLinks");
    expect(publicCompanyLinks.linkedIn).toBe("https://linkedin.com/company/kravia-private-limited");
  });

  it("publishes only genuine portraits in Person structured data and no unapproved profile links", () => {
    const schema = JSON.parse(JSON.stringify(leadershipJsonLd("https://www.kraviaprivatelimited.com")));
    const graph: Array<Record<string, unknown>> = schema["@graph"];
    const people = graph.filter((entry) => entry["@type"] === "Person");
    expect(people).toHaveLength(3);
    for (const person of teamProfiles) {
      const entry = people.find((candidate) => candidate.name === person.name);
      expect(entry).toMatchObject({
        image: "https://www.kraviaprivatelimited.com" + person.portrait!.src,
        jobTitle: person.title,
      });
      expect(entry).not.toHaveProperty("email");
      expect(entry).not.toHaveProperty("sameAs");
      expect(entry).not.toHaveProperty("telephone");
    }
  });

  it("retains small circular avatars and the public-only compact typography scale", () => {
    const css = source("components/leadership/leadership.module.css");
    expect(css).toContain("width: 128px; height: 128px;");
    expect(css).toContain("width: 104px; height: 104px;");
    expect(css).toContain("width: 48px; height: 48px;");
    expect(css).toContain("border-radius: 50%");
    expect(css).toContain(".currentFocus");
    expect(css).not.toContain(".portraitLink");
    expect(css).not.toContain(".emailLink");
    const publicCss = source("app/public-typography.css");
    expect(source("app/layout.tsx")).toContain('import "./public-typography.css"');
    expect(publicCss).toContain("@media screen");
    expect(publicCss).toContain("body:has(.nav-wrap) .hero h1");
    expect(publicCss).not.toContain("zoom:");
  });
});
