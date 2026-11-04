import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui", () => import("../components/ui/skeleton"));
import { PublicContentSkeleton } from "../components/loading-skeletons";

const app = resolve(process.cwd(), "app");
const publicRoot = join(app, "(public)");
const source = (path: string) => readFileSync(join(publicRoot, path), "utf8");

describe("persistent public navigation boundaries", () => {
  it("owns public chrome once in a nested layout under the original document root", () => {
    const layout = source("layout.tsx");
    expect(layout.match(/<SiteNav\s*\/>/g)).toHaveLength(1);
    expect(layout.match(/<Footer\s*\/>/g)).toHaveLength(1);
    expect(layout).toContain("{children}");
    expect(layout).toContain("<Suspense fallback={null}><Footer /></Suspense>");
    expect(layout).not.toMatch(/<(html|body|main)[\s>]/);
    const rootLayout = readFileSync(join(app, "layout.tsx"), "utf8");
    expect(rootLayout).toContain('<html lang="en"');
    expect(rootLayout).not.toContain("<SiteNav");
  });

  it("keeps page, pending, error and not-found states inside the shared chrome", () => {
    const routeFiles = readdirSync(publicRoot, { recursive: true, encoding: "utf8" })
      .filter(path => path.endsWith("page.tsx") || path.endsWith("loading.tsx"));
    expect(routeFiles.length).toBeGreaterThanOrEqual(12);
    for (const route of routeFiles) {
      expect(source(route), route).not.toMatch(/<(SiteNav|Footer)\b/);
    }
    expect(source("loading.tsx")).toContain("PublicContentSkeleton");
    expect(source("error.tsx")).toContain('export { default } from "../error"');
    expect(source("not-found.tsx")).toContain('export { default } from "../not-found"');
  });

  it("retains public URLs, product metadata routes, and existing redirect handlers", () => {
    const routes = ["page.tsx", "[...segments]/page.tsx", "company/leadership/page.tsx",
      "products/vidyaluma/page.tsx", "products/nicerole/page.tsx", "products/recruitflow/page.tsx",
      "products/vorio/page.tsx", "products/vorio/opengraph-image.tsx", "products/yukta/page.tsx",
      "products/yukta/opengraph-image.tsx", "contact/page.tsx", "privacy-request/page.tsx",
      "support/page.tsx", "support/loading.tsx", "legal/preview/[slug]/page.tsx"];
    for (const route of routes) {
      expect(existsSync(join(publicRoot, route)), route).toBe(true);
      expect(existsSync(join(app, route)), `duplicate route ${route}`).toBe(false);
    }
    expect(source("products/recruitflow/page.tsx")).toContain('permanentRedirect("/products/nicerole")');
    expect(source("[...segments]/page.tsx")).toContain("resolvePublishedRedirect");
  });

  it("does not move private workspaces, callbacks or API endpoints into the public shell", () => {
    for (const route of ["office", "admin", "finance", "corporate", "auth", "api"]) {
      expect(existsSync(join(app, route)), route).toBe(true);
      expect(existsSync(join(publicRoot, route)), route).toBe(false);
    }
    expect(existsSync(join(app, "newsroom/rss.xml/route.ts"))).toBe(true);
  });

  it("announces content loading without replacing the navbar or faking a homepage", () => {
    const html = renderToStaticMarkup(<PublicContentSkeleton />);
    expect(html).toContain('id="main-content"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status">Loading page');
    expect(html).not.toMatch(/<(header|nav|footer|h1)[\s>]/);
    expect(html).not.toContain("Technology for");
    expect(html).not.toContain("home-title");
  });
});
