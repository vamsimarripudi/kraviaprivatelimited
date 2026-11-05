import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomepageReveal, initializeHomepageReveal } from "../components/homepage-reveal";

function setup({ top = 1200, reduced = false, focused = false, observers = true } = {}) {
  const preference = Object.assign(new EventTarget(), { matches: reduced });
  const element = Object.assign(new EventTarget(), {
    dataset: { revealed: "true" } as Record<string, string>,
    getBoundingClientRect: () => ({ top }),
    matches: vi.fn(() => focused),
  });
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  let callback = (_entries: { isIntersecting: boolean }[]) => {};
  const observe = vi.fn();
  const disconnect = vi.fn();
  class Observer {
    constructor(onChange: typeof callback) { callback = onChange; }
    observe = observe;
    disconnect = disconnect;
  }
  vi.stubGlobal("window", { innerHeight: 900, matchMedia: () => preference });
  vi.stubGlobal("IntersectionObserver", observers ? Observer : undefined);
  vi.stubGlobal("requestAnimationFrame", vi.fn((handler: FrameRequestCallback) => { frames.set(++serial, handler); return serial; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { frames.delete(id); }));
  const mount = () => initializeHomepageReveal(element as unknown as HTMLElement);
  const cleanup = mount();
  return {
    element, preference, frames, observe, disconnect, mount, cleanup,
    intersect(value: boolean) { callback([{ isIntersecting: value }]); },
    motion(value: boolean) { preference.matches = value; preference.dispatchEvent(new Event("change")); },
    nextFrame() {
      const pending = frames.entries().next().value;
      if (!pending) throw new Error("Expected animation frame");
      frames.delete(pending[0]); pending[1](100);
    },
  };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("homepage reveal progressive enhancement", () => {
  it("server-renders readable semantic content and preserves links and attributes", () => {
    const html = renderToStaticMarkup(<HomepageReveal as="article" id="product" aria-label="Featured product">
      <h2>Product engineering</h2><a href="/products">Explore products</a>
    </HomepageReveal>);
    expect(html).toContain("<article");
    expect(html).toContain('id="product"');
    expect(html).toContain('aria-label="Featured product"');
    expect(html).toContain('data-revealed="true"');
    expect(html).not.toContain('data-revealed="false"');
    expect(html).toContain('href="/products"');
  });

  it("bounds stagger delays without turning invalid numbers into CSS", () => {
    expect(renderToStaticMarkup(<HomepageReveal delay={900}>One</HomepageReveal>)).toContain("--homepage-reveal-delay:240ms");
    expect(renderToStaticMarkup(<HomepageReveal delay={-5}>Two</HomepageReveal>)).toContain("--homepage-reveal-delay:0ms");
    expect(renderToStaticMarkup(<HomepageReveal delay={Infinity}>Three</HomepageReveal>)).toContain("--homepage-reveal-delay:0ms");
  });

  it.each([0, 450, -1000])("keeps initially visible or previously passed content visible at top %s", (top) => {
    const test = setup({ top });
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.observe).not.toHaveBeenCalled();
    expect(test.frames.size).toBe(0);
  });

  it("arms only offscreen content and reveals it once when it intersects", () => {
    const test = setup();
    expect(test.element.dataset.revealed).toBe("false");
    expect(test.element.dataset.revealReady).toBe("false");
    test.nextFrame();
    expect(test.element.dataset.revealReady).toBe("true");
    test.intersect(true);
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.element.dataset.revealComplete).toBe("true");
    expect(test.disconnect).toHaveBeenCalledOnce();
    test.intersect(false);
    expect(test.element.dataset.revealed).toBe("true");
  });

  it("leaves reduced-motion content visible and immediately reveals an armed section when preference changes", () => {
    const initial = setup({ reduced: true });
    expect(initial.element.dataset.revealed).toBe("true");
    expect(initial.frames.size).toBe(0);
    initial.cleanup();
    const test = setup();
    test.motion(true);
    expect(test.frames.size).toBe(0);
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.element.dataset.revealReady).toBe("false");
    expect(test.element.dataset.revealMotion).toBe("reduced");
    test.motion(false);
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.frames.size).toBe(0);
  });

  it("reveals keyboard-focused content immediately even before the intersection callback", () => {
    const test = setup();
    test.element.dispatchEvent(new Event("focusin"));
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.element.dataset.revealReady).toBe("false");
    expect(test.frames.size).toBe(0);
    expect(test.disconnect).toHaveBeenCalledOnce();
  });

  it("never arms a section that already contains focus", () => {
    const test = setup({ focused: true });
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.observe).not.toHaveBeenCalled();
  });

  it("falls back to visible content when IntersectionObserver is unavailable", () => {
    const test = setup({ observers: false });
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.frames.size).toBe(0);
  });

  it("restores visibility on cleanup and ignores stale callbacks after route unmount", () => {
    const test = setup();
    const lateFrame = test.frames.values().next().value!;
    test.cleanup();
    expect(test.frames.size).toBe(0);
    expect(test.element.dataset.revealed).toBe("true");
    expect(test.element.dataset.revealReady).toBe("false");
    expect(test.disconnect).toHaveBeenCalledOnce();
    lateFrame(100);
    test.intersect(true);
    test.motion(true);
    expect(test.element.dataset.revealReady).toBe("false");
    expect(test.element.dataset.revealComplete).toBeUndefined();
  });

  it("supports StrictMode replay without leaving stale callbacks or permanently hiding the section", () => {
    const test = setup();
    test.cleanup();
    const replayCleanup = test.mount();
    expect(test.frames.size).toBe(1);
    expect(test.element.dataset.revealed).toBe("false");
    test.nextFrame();
    test.intersect(true);
    expect(test.element.dataset.revealed).toBe("true");
    replayCleanup();
    expect(test.frames.size).toBe(0);
    expect(test.element.dataset.revealed).toBe("true");
  });
});
