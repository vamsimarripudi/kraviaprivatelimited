import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeadershipContent, LeadershipPreview } from "../components/leadership/leadership-content";
import { LeadershipMedia } from "../components/leadership/leadership-media";
import { defaultProfileImage, leadershipAssets, leadershipJsonLd, leadershipPath, leadershipRelationships, leadershipTitle, publishedTeam, serializeLeadershipJsonLd, startupOverview, teamPersonId, teamProfiles, type TeamProfile } from "../lib/leadership";
import { vidyaLumaProduct } from "../lib/products/vidyaluma";

const origin = "https://www.kraviaprivatelimited.com";
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// These tests exercise the same components used by the public route, not duplicate markup.
describe("Leadership & Team", () => {
  it("publishes the three owner-supplied names and separates founders from the team", () => {
    const people = publishedTeam();
    expect(people.map((person) => person.name)).toEqual(["Vamsi Marripudi", "Satish Manohar Pennada", "Jaya Satyanarayana Mangam"]);
    expect(people.filter((person) => person.group === "founder")).toHaveLength(2);
    expect(people.filter((person) => person.group === "team")).toHaveLength(1);
    expect(new Set(people.map((person) => person.id)).size).toBe(3);
  });

  it("keeps the selected titles and Vamsi's hands-on execution explicit", () => {
    expect(teamProfiles[0].title).toBe("Founder & CTO");
    expect(teamProfiles[0].disciplines).toContain("Product Architect");
    expect(teamProfiles[1].title).toBe("Co-Founder, CEO & CFO");
    expect(teamProfiles[2].title).toBe("Frontend Developer & Marketing and Sales Lead");
    expect(startupOverview.paragraphs.join(" ")).toContain("day-to-day technical execution are led by Vamsi");
  });

  it("excludes draft profiles from published data, people schema and company relationships", () => {
    const draft: TeamProfile = { ...teamProfiles[0], id: "draft-person", publicationStatus: "draft" };
    expect(publishedTeam([draft])).toEqual([]);
    expect(leadershipJsonLd(origin, [draft])["@graph"]).toHaveLength(1);
    expect(leadershipRelationships(origin, [draft])).toEqual({ founder: [], member: [] });
  });

  it("renders every profile, a single h1 and the pre-revenue flagship narrative", () => {
    const html = renderToStaticMarkup(<LeadershipContent />);
    for (const person of teamProfiles) {
      expect(html).toContain(person.name);
      expect(html).toContain(`id="${person.id}"`);
    }
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.match(/data-team-group="founder"/g)).toHaveLength(2);
    expect(html.match(/data-team-group="team"/g)).toHaveLength(1);
    expect(html).toContain("Pre-revenue");
    expect(html).toContain("Our flagship product");
    expect(html).toContain("In development");
  });

  it("links to the existing product route and official product domain", () => {
    const html = renderToStaticMarkup(<LeadershipContent />);
    expect(html).toContain(`href="${vidyaLumaProduct.href}"`);
    expect(html).toContain(`href="${vidyaLumaProduct.website}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(existsSync(resolve(process.cwd(), "app/products/vidyaluma/page.tsx"))).toBe(true);
  });

  it("renders the supplied default avatar and a text-only pending product logo", () => {
    const html = renderToStaticMarkup(<><LeadershipMedia asset={null} name="Test profile" fallback="TP" /><LeadershipMedia asset={null} name="VidyaLuma" fallback="VidyaLuma" variant="logo" /></>);
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain('data-media-state="default"');
    expect(html.match(/data-media-state="text"/g)).toHaveLength(1);
    expect(html).toContain('alt="Default profile image for Test profile"');
    expect(html).toContain("VidyaLuma</span>");
  });

  it("requires configured assets to exist and carry valid dimensions", () => {
    const assets = [defaultProfileImage, ...teamProfiles.map((person) => person.portrait), leadershipAssets.vidyalumaLogo];
    for (const asset of assets) {
      if (!asset) continue;
      expect(asset.src).toMatch(/^\/(team|brand)\/[a-zA-Z0-9/_-]+\.(webp|avif|png|jpe?g)$/);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(existsSync(resolve(process.cwd(), "public", asset.src.slice(1)))).toBe(true);
    }
  });

  it("supports a supplied portrait with alt text, dimensions and responsive delivery", () => {
    const html = renderToStaticMarkup(<LeadershipMedia asset={{ src: "/team/test-portrait.webp", width: 800, height: 1000 }} name="Test profile" fallback="TP" />);
    expect(html).toContain('alt="Test profile"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="1000"');
    expect(html).toContain('data-media-state="image"');
    expect(html).toContain("srcSet=");
  });

  it("supports a supplied logo independently of the portraits", () => {
    const html = renderToStaticMarkup(<LeadershipMedia asset={{ src: "/brand/test-logo.webp", width: 1000, height: 300 }} name="VidyaLuma" fallback="VidyaLuma" variant="logo" />);
    expect(html).toContain('alt="VidyaLuma"');
    expect(html).toContain('data-media-state="image"');
  });

  it("omits absent portraits and unprovided professional links from structured data", () => {
    const schema = leadershipJsonLd(origin, teamProfiles.map((person) => ({ ...person, portrait: null, linkedIn: null, portfolio: null })));
    expect(schema["@graph"]).toHaveLength(4);
    const people = schema["@graph"].filter((entry) => entry["@type"] === "Person");
    for (const person of people) {
      expect(person).not.toHaveProperty("image");
      expect(person).not.toHaveProperty("sameAs");
      expect(person).toHaveProperty("worksFor", { "@id": `${origin}#organization` });
    }
    expect(schema["@graph"].some((entry) => ["Organization", "Corporation"].includes(entry["@type"]))).toBe(false);
  });

  it("connects only the two founders and the key team member to the existing company entity", () => {
    expect(leadershipRelationships(origin)).toEqual({
      founder: teamProfiles.slice(0, 2).map((person) => ({ "@id": teamPersonId(origin, person.id) })),
      member: [{ "@id": teamPersonId(origin, teamProfiles[2].id) }],
    });
    expect(source("components/structured-data.tsx")).toContain("...leadershipRelationships(siteUrl)");
  });

  it("normalizes the origin and safely serializes script content", () => {
    expect(teamPersonId(`${origin}/`, "person")).toBe(`${origin}${leadershipPath}#person`);
    const value = { name: "</script><script>test</script>" };
    const serialized = serializeLeadershipJsonLd(value);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(value);
  });

  it("links preview names and avatars to the supplied portfolio or profile anchor", () => {
    const html = renderToStaticMarkup(<LeadershipPreview />);
    for (const person of teamProfiles) expect(html).toContain(`href="${person.portfolio ?? `${leadershipPath}#${person.id}`}"`);
    expect(html).toContain(`href="${leadershipPath}"`);
  });

  it("integrates both managed and fallback company pages, footer, sitemap and metadata", () => {
    expect(source("app/[...segments]/page.tsx").match(/<LeadershipPreview \/>/g)).toHaveLength(2);
    expect(source("components/footer.tsx")).toContain('["Leadership & Team", "/company/leadership"]');
    expect(source("app/sitemap.ts")).toContain('"company/leadership"');
    const route = source("app/company/leadership/page.tsx");
    expect(route).toContain("publicPageRobots(isProductionSite)");
    expect(route).toContain("alternates: { canonical: leadershipPath }");
    expect(route).toContain("serializeLeadershipJsonLd(leadershipJsonLd(siteUrl))");
    expect(leadershipTitle).toBe("Leadership & Team");
  });
  it("keeps the shared entry splash hydration deterministic", () => {
    const splash = source("components/brand-splash.tsx");
    expect(splash).toContain("useSyncExternalStore(subscribeHydration, clientHydrationSnapshot, serverHydrationSnapshot)");
    expect(splash).toContain("const reducedMotion = hydrated && motionPreference");
    expect(splash).not.toContain("suppressHydrationWarning");
  });
});
