import { afterEach, describe, expect, it, vi } from "vitest";
import { observeNavigationSurface } from "../components/site-nav-lifecycle";

afterEach(() => vi.unstubAllGlobals());

function browserHarness() {
  const events = new EventTarget();
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  let mutation: (() => void) | undefined;
  let surfaceBounds: { top: number; bottom: number }[] = [];
  const observe = vi.fn();
  const disconnect = vi.fn();
  const query = vi.fn(() => surfaceBounds.map((bounds) => ({ getBoundingClientRect: () => bounds })));
  const cancel = vi.fn((frame: number) => frames.delete(frame));
  const body = {};
  vi.stubGlobal("document", { body, querySelectorAll: query });
  vi.stubGlobal("window", {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: cancel,
  });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { mutation = callback; }
    observe = observe;
    disconnect = disconnect;
  });

  return {
    header: { getBoundingClientRect: () => ({ top: 0, height: 72 }) } as HTMLElement,
    events, frames, query, observe, disconnect, cancel, body,
    replaceSurfaces(bounds: typeof surfaceBounds) { surfaceBounds = bounds; mutation?.(); },
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(0)); },
  };
}

describe("persistent navbar surface tracking", () => {
  it("rechecks streamed content and coalesces mutation, resize and scroll bursts", () => {
    const browser = browserHarness();
    const update = vi.fn();
    const stop = observeNavigationSurface(browser.header, update);
    browser.flush();
    expect(update).toHaveBeenLastCalledWith(false);
    expect(browser.observe).toHaveBeenCalledWith(browser.body, { childList: true, subtree: true });

    browser.replaceSurfaces([{ top: 0, bottom: 600 }]);
    browser.events.dispatchEvent(new Event("scroll"));
    browser.events.dispatchEvent(new Event("resize"));
    browser.replaceSurfaces([{ top: 0, bottom: 600 }]);
    expect(browser.frames.size).toBe(1);
    expect(browser.query).toHaveBeenCalledTimes(1);
    browser.flush();
    expect(update.mock.calls).toEqual([[false], [true]]);

    browser.replaceSurfaces([]);
    browser.flush();
    expect(update).toHaveBeenLastCalledWith(false);
    stop();
  });

  it("uses the navbar center and updates when a dark section leaves that point", () => {
    const browser = browserHarness();
    const update = vi.fn();
    const stop = observeNavigationSurface(browser.header, update);
    browser.replaceSurfaces([{ top: 37, bottom: 300 }, { top: -100, bottom: 36 }]);
    browser.flush();
    expect(update).toHaveBeenLastCalledWith(false);
    browser.replaceSurfaces([{ top: 36, bottom: 300 }]);
    browser.flush();
    expect(update).toHaveBeenLastCalledWith(true);
    stop();
  });

  it("disconnects listeners and cancels queued measurements across unmount or effect replay", () => {
    const browser = browserHarness();
    const update = vi.fn();
    const stop = observeNavigationSurface(browser.header, update);
    const staleCallback = [...browser.frames.values()][0];
    stop();
    expect(browser.disconnect).toHaveBeenCalledOnce();
    expect(browser.cancel).toHaveBeenCalledOnce();
    browser.events.dispatchEvent(new Event("scroll"));
    browser.events.dispatchEvent(new Event("resize"));
    browser.replaceSurfaces([{ top: 0, bottom: 600 }]);
    staleCallback(0);
    browser.flush();
    expect(browser.frames.size).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(browser.query).not.toHaveBeenCalled();

    const stopReplay = observeNavigationSurface(browser.header, update);
    browser.flush();
    expect(update).toHaveBeenCalledExactlyOnceWith(true);
    stopReplay();
  });
});
