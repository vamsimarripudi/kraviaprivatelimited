import { afterEach, describe, expect, it, vi } from "vitest";
import { createTechnologyScene } from "../lib/visuals/technology-scene";

function setupScene({ hasContext = true, pixelRatio = 1, width = 1200, height = 700 } = {}) {
  const context = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  };
  const bounds = { width, height };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => hasContext ? context : null),
    getBoundingClientRect: vi.fn(() => bounds),
  };
  const document = Object.assign(new EventTarget(), { hidden: false });
  const addListener = vi.spyOn(document, "addEventListener");
  const removeListener = vi.spyOn(document, "removeEventListener");
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  const cancelFrame = vi.fn((id: number) => { frames.delete(id); });
  let resizeCallback = () => {};
  let intersectCallback = (_entries: { isIntersecting: boolean }[]) => {};
  const resizeObserve = vi.fn();
  const resizeDisconnect = vi.fn();
  const intersectObserve = vi.fn();
  const intersectDisconnect = vi.fn();
  class MockResizeObserver {
    constructor(callback: () => void) { resizeCallback = callback; }
    observe = resizeObserve;
    disconnect = resizeDisconnect;
  }
  class MockIntersectionObserver {
    constructor(callback: typeof intersectCallback) { intersectCallback = callback; }
    observe = intersectObserve;
    disconnect = intersectDisconnect;
  }
  vi.stubGlobal("window", { devicePixelRatio: pixelRatio });
  vi.stubGlobal("document", document);
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  const scene = createTechnologyScene(canvas as unknown as HTMLCanvasElement);
  return {
    scene, canvas, bounds, context, document, frames, requestFrame, cancelFrame,
    addListener, removeListener, resizeObserve, resizeDisconnect, intersectObserve, intersectDisconnect,
    resize() { resizeCallback(); },
    setIntersecting(value: boolean) { intersectCallback([{ isIntersecting: value }]); },
    setHidden(value: boolean) {
      document.hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    },
    nextFrame(timestamp: number) {
      const pending = frames.entries().next().value;
      if (!pending) throw new Error("Expected a scheduled animation frame");
      const [id, callback] = pending;
      frames.delete(id);
      callback(timestamp);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("technology scene lifecycle", () => {
  it("returns a safe fallback without listeners or observers when a 2D context is unavailable", () => {
    const test = setupScene({ hasContext: false });
    expect(test.scene).toBeNull();
    expect(test.canvas.getContext).toHaveBeenCalledWith("2d");
    expect(test.resizeObserve).not.toHaveBeenCalled();
    expect(test.intersectObserve).not.toHaveBeenCalled();
    expect(test.addListener).not.toHaveBeenCalled();
    expect(test.requestFrame).not.toHaveBeenCalled();
  });

  it("renders one still frame on creation without enabling animation", () => {
    const test = setupScene();
    expect(test.scene).not.toBeNull();
    expect(test.context.clearRect).toHaveBeenCalledExactlyOnceWith(0, 0, 1200, 700);
    expect(test.context.stroke).toHaveBeenCalled();
    expect(test.frames.size).toBe(0);
    expect(test.resizeObserve).toHaveBeenCalledExactlyOnceWith(test.canvas);
    expect(test.intersectObserve).toHaveBeenCalledExactlyOnceWith(test.canvas);
  });

  it("runs a single frame loop when enabled and stops scheduling when paused", () => {
    const test = setupScene();
    test.scene!.setMotion(true);
    expect(test.frames.size).toBe(1);
    test.nextFrame(100);
    expect(test.context.clearRect).toHaveBeenCalledTimes(2);
    expect(test.frames.size).toBe(1);
    const activeId = test.frames.keys().next().value;
    test.scene!.setMotion(false);
    expect(test.cancelFrame).toHaveBeenLastCalledWith(activeId);
    expect(test.frames.size).toBe(0);
    test.scene!.setMotion(true);
    test.scene!.setMotion(true);
    expect(test.frames.size).toBe(1);
  });

  it("retains a still frame when the caller disables motion for a reduced-motion preference", () => {
    const test = setupScene();
    test.scene!.setMotion(false);
    test.setIntersecting(true);
    test.setHidden(false);
    test.resize();
    expect(test.requestFrame).not.toHaveBeenCalled();
    expect(test.context.clearRect).toHaveBeenCalledTimes(2);
    expect(test.context.stroke).toHaveBeenCalled();
  });

  it("suspends a running scene while the document is hidden and resumes when visible", () => {
    const test = setupScene();
    test.scene!.setMotion(true);
    test.setHidden(true);
    expect(test.frames.size).toBe(0);
    const drawCount = test.context.clearRect.mock.calls.length;
    test.setHidden(false);
    expect(test.frames.size).toBe(1);
    test.nextFrame(9000);
    expect(test.context.clearRect).toHaveBeenCalledTimes(drawCount + 1);
  });

  it("does not start in a hidden document or resume a user-paused scene on visibility changes", () => {
    const test = setupScene();
    test.setHidden(true);
    test.scene!.setMotion(true);
    expect(test.requestFrame).not.toHaveBeenCalled();
    test.setHidden(false);
    expect(test.frames.size).toBe(1);
    test.scene!.setMotion(false);
    test.setHidden(true);
    test.setHidden(false);
    expect(test.frames.size).toBe(0);
  });

  it("suspends offscreen rendering and resumes only when both onscreen and document-visible", () => {
    const test = setupScene();
    test.scene!.setMotion(true);
    test.setIntersecting(false);
    expect(test.frames.size).toBe(0);
    test.setHidden(true);
    test.setIntersecting(true);
    expect(test.frames.size).toBe(0);
    test.setHidden(false);
    expect(test.frames.size).toBe(1);
    test.nextFrame(100);
    expect(test.context.clearRect).toHaveBeenCalledTimes(2);
  });

  it("disconnects observers and listeners on destroy and ignores late callbacks", () => {
    const test = setupScene();
    test.scene!.setMotion(true);
    const lateFrame = test.frames.values().next().value!;
    const activeId = test.frames.keys().next().value;
    const visibilityCallback = test.addListener.mock.calls.find(([event]) => event === "visibilitychange")![1];
    test.scene!.destroy();
    expect(test.cancelFrame).toHaveBeenCalledWith(activeId);
    expect(test.frames.size).toBe(0);
    expect(test.resizeDisconnect).toHaveBeenCalledOnce();
    expect(test.intersectDisconnect).toHaveBeenCalledOnce();
    expect(test.removeListener).toHaveBeenCalledWith("visibilitychange", visibilityCallback);
    const drawCount = test.context.clearRect.mock.calls.length;
    const requestCount = test.requestFrame.mock.calls.length;
    lateFrame(200);
    test.resize();
    test.setIntersecting(true);
    test.setHidden(false);
    test.scene!.setMotion(true);
    expect(test.frames.size).toBe(0);
    expect(test.requestFrame).toHaveBeenCalledTimes(requestCount);
    expect(test.context.clearRect).toHaveBeenCalledTimes(drawCount);
  });

  it("caps high-DPR backing resolution and redraws after a responsive resize", () => {
    const test = setupScene({ pixelRatio: 3 });
    expect(test.canvas.width).toBe(1800);
    expect(test.canvas.height).toBe(1050);
    expect(test.context.setTransform).toHaveBeenLastCalledWith(1.5, 0, 0, 1.5, 0, 0);
    test.bounds.width = 390;
    test.bounds.height = 640;
    test.resize();
    expect(test.canvas.width).toBe(585);
    expect(test.canvas.height).toBe(960);
    expect(test.context.clearRect).toHaveBeenLastCalledWith(0, 0, 390, 640);
    expect(test.frames.size).toBe(0);
  });

  it("uses the native lower DPR without magnification and tolerates zero-size layout", () => {
    const test = setupScene({ pixelRatio: 1.25, width: 390, height: 640 });
    expect(test.canvas.width).toBe(488);
    expect(test.canvas.height).toBe(800);
    expect(test.context.setTransform).toHaveBeenLastCalledWith(1.25, 0, 0, 1.25, 0, 0);
    test.bounds.width = 0;
    test.bounds.height = 0;
    const drawCount = test.context.clearRect.mock.calls.length;
    expect(() => test.resize()).not.toThrow();
    expect(test.canvas.width).toBe(0);
    expect(test.canvas.height).toBe(0);
    expect(test.context.clearRect).toHaveBeenCalledTimes(drawCount);
  });
});
