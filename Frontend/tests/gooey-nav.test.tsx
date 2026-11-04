import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GooeyNav, { type GooeyNavItem } from "../components/gooey-nav";

const items: readonly GooeyNavItem[] = [
  { label: "Company", href: "/company" },
  { label: "Products", href: "/products" },
  { label: "Trust", href: "/trust" },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("GooeyNav accessible server output", () => {
  it("renders real navigation links without requiring a browser or adding a nested navigation landmark", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);

    const html = renderToString(<GooeyNav items={items} activeIndex={-1} />);

    expect(html.match(/<a[ >]/g)).toHaveLength(items.length);
    for (const item of items) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<nav");
    expect(html).not.toContain('href="#"');
    expect(html).toMatch(/<canvas[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<ul[^>]*aria-hidden="true"/);
  });

  it("exposes exactly the route supplied by the parent as the current page", () => {
    const html = renderToString(<GooeyNav items={items} activeIndex={1} />);

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const activeAnchor = html.match(/<a\b(?=[^>]*aria-current="page")[^>]*>/)?.[0];
    expect(activeAnchor).toContain('href="/products"');
  });

  it.each([-1, 3, 99, Number.NaN])("does not invent a current page for invalid or unselected index %s", (activeIndex) => {
    expect(renderToString(<GooeyNav items={items} activeIndex={activeIndex} />)).not.toContain("aria-current");
  });

  it("renders an empty collection without default demonstration links", () => {
    const html = renderToString(<GooeyNav items={[]} activeIndex={0} />);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("Home");
  });

  it.each([false, true])("keeps hydration markup stable when reduced motion is %s", (matches) => {
    vi.stubGlobal("window", undefined);
    const html = renderToString(<GooeyNav items={items} activeIndex={0} frame={false} />);
    const matchMedia = vi.fn(() => ({ matches }));
    vi.stubGlobal("window", { matchMedia });

    expect(renderToString(<GooeyNav items={items} activeIndex={0} frame={false} />)).toBe(html);
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
