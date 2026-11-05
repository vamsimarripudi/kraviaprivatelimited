import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDarkVeilScene, type DarkVeilSettings } from '../lib/visuals/dark-veil-scene';

const defaults: DarkVeilSettings = {
  color: '#72b7ce', speed: 0.24, scale: 1, rotation: 0, flow: 0.7, warp: 0.12,
  variation: 0, brightness: 0.85, sheen: 0.2, glow: 0.3, grain: 0.015, quality: 0.5,
  mouseInteraction: false, mouseStrength: 1, intro: false, fade: 0.12, opacity: 0.85,
  lightMode: false, paused: false, dpr: 1.25,
};

function setup({ reduced = false, hasContext = true, failShader = 0, completeFramebuffer = true, offscreen = false } = {}) {
  let serial = 0;
  let shaderNumber = 0;
  let lost = false;
  const loseContext = vi.fn(() => { lost = true; });
  let boundTexture: object | null = null;
  const allocations = new Set<object>();
  const immutableTextures = new Set<object>();
  const allocate = () => { const resource = { id: ++serial }; allocations.add(resource); return resource; };
  const remove = vi.fn((resource: object | null) => { if (resource) allocations.delete(resource); });
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ACTIVE_UNIFORMS: 5,
    ARRAY_BUFFER: 6, STATIC_DRAW: 7, FLOAT: 8, TEXTURE0: 9, TEXTURE_2D: 10, RGBA16F: 11, RGBA8: 12,
    TEXTURE_MIN_FILTER: 13, LINEAR_MIPMAP_LINEAR: 14, TEXTURE_MAG_FILTER: 15, LINEAR: 16,
    TEXTURE_WRAP_S: 17, TEXTURE_WRAP_T: 18, CLAMP_TO_EDGE: 19, FRAMEBUFFER: 20,
    COLOR_ATTACHMENT0: 21, FRAMEBUFFER_COMPLETE: 22, TRIANGLES: 23,
    createShader: vi.fn(() => { shaderNumber++; return allocate(); }),
    getShaderParameter: vi.fn(() => !lost && shaderNumber !== failShader),
    getShaderInfoLog: vi.fn(() => 'Synthetic compilation failure'),
    getProgramInfoLog: vi.fn(() => 'Synthetic link failure'),
    createProgram: vi.fn(allocate),
    getProgramParameter: vi.fn((_program: object, parameter: number) => parameter === 4 ? true : 0),
    createBuffer: vi.fn(allocate), createVertexArray: vi.fn(allocate), createFramebuffer: vi.fn(allocate),
    createTexture: vi.fn(allocate),
    deleteShader: remove, deleteProgram: remove, deleteBuffer: remove,
    deleteVertexArray: remove, deleteFramebuffer: remove, deleteTexture: remove,
    bindTexture: vi.fn((_target: number, texture: object | null) => { boundTexture = texture; }),
    texStorage2D: vi.fn(() => {
      if (!boundTexture || immutableTextures.has(boundTexture)) throw new Error('Immutable texture allocated twice');
      immutableTextures.add(boundTexture);
    }),
    checkFramebufferStatus: vi.fn(() => completeFramebuffer ? 22 : 0),
    getExtension: vi.fn((name: string) => name === 'WEBGL_lose_context' ? { loseContext } : null),
    shaderSource: vi.fn(), compileShader: vi.fn(), attachShader: vi.fn(), bindAttribLocation: vi.fn(),
    linkProgram: vi.fn(), bindVertexArray: vi.fn(), bindBuffer: vi.fn(), bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(), vertexAttribPointer: vi.fn(), activeTexture: vi.fn(),
    texParameteri: vi.fn(), bindFramebuffer: vi.fn(), framebufferTexture2D: vi.fn(), viewport: vi.fn(),
    useProgram: vi.fn(), uniform2f: vi.fn(), uniform1f: vi.fn(), uniform3f: vi.fn(), uniform4f: vi.fn(),
    uniform3fv: vi.fn(), uniform1i: vi.fn(), drawArrays: vi.fn(), generateMipmap: vi.fn(),
  };
  const query = Object.assign(new EventTarget(), { matches: reduced });
  const window = Object.assign(new EventTarget(), {
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3,
    matchMedia: vi.fn(() => query),
  });
  const document = Object.assign(new EventTarget(), {
    hidden: false, documentElement: new EventTarget(),
    createElement: vi.fn(() => ({ getContext: () => null })),
  });
  const container = {
    clientWidth: 1200, clientHeight: 700, dataset: {} as Record<string, string>,
    getBoundingClientRect: () => ({ top: offscreen ? 1100 : 0, bottom: offscreen ? 1800 : 700, left: 0, right: 1200, width: 1200, height: 700 }),
  };
  const canvas = Object.assign(new EventTarget(), { width: 0, height: 0, getContext: vi.fn(() => hasContext ? gl : null) });
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  const cancelFrame = vi.fn((id: number) => { frames.delete(id); });
  let resizeCallback = () => {};
  let intersectionCallback = (_entries: { isIntersecting: boolean }[]) => {};
  const resizeDisconnect = vi.fn();
  const intersectionDisconnect = vi.fn();
  class ResizeObserver {
    constructor(callback: () => void) { resizeCallback = callback; }
    observe = vi.fn();
    disconnect = resizeDisconnect;
  }
  class IntersectionObserver {
    constructor(callback: typeof intersectionCallback) { intersectionCallback = callback; }
    observe = vi.fn();
    disconnect = intersectionDisconnect;
  }
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.stubGlobal('ResizeObserver', ResizeObserver);
  vi.stubGlobal('IntersectionObserver', IntersectionObserver);
  const settings = { ...defaults };
  const scene = createDarkVeilScene(container as unknown as HTMLDivElement, canvas as unknown as HTMLCanvasElement, () => settings);
  return {
    scene, gl, canvas, container, settings, frames, allocations, immutableTextures, query, requestFrame, loseContext,
    cancelFrame, document, resizeDisconnect, intersectionDisconnect,
    resize: () => resizeCallback(),
    intersect: (value: boolean) => intersectionCallback([{ isIntersecting: value }]),
    motion(value: boolean) { query.matches = value; query.dispatchEvent(new Event('change')); },
    hidden(value: boolean) { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
    frame(timestamp: number) {
      const entry = frames.entries().next().value;
      if (!entry) throw new Error('Expected scheduled frame');
      frames.delete(entry[0]); entry[1](timestamp);
    },
  };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('DarkVeil resource and motion lifecycle', () => {
  it('leaves the CSS fallback and allocates nothing when WebGL is unavailable', () => {
    const test = setup({ hasContext: false });
    expect(test.scene).toBeNull();
    expect(test.container.dataset.darkVeilState).toBe('fallback');
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
  });

  it('releases every partial allocation after a shader compilation failure', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const test = setup({ failShader: 2 });
    expect(warning).toHaveBeenCalledWith('[DarkVeil] Shader compilation failed:', 'Synthetic compilation failure');
    expect(test.scene).toBeNull();
    expect(test.allocations.size).toBe(0);
    expect(test.gl.drawArrays).not.toHaveBeenCalled();
    expect(test.container.dataset.darkVeilState).toBe('fallback');
  });

  it('replaces immutable texture storage on resize and reuses it for unchanged sizes', () => {
    const test = setup();
    const firstTexture = test.gl.createTexture.mock.results[0].value;
    expect(test.gl.texStorage2D).toHaveBeenCalledTimes(1);
    test.resize();
    expect(test.gl.texStorage2D).toHaveBeenCalledTimes(1);
    test.container.clientWidth = 390;
    test.container.clientHeight = 640;
    expect(() => test.resize()).not.toThrow();
    expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
    expect(test.gl.texStorage2D).toHaveBeenCalledTimes(2);
    expect(test.gl.deleteTexture).toHaveBeenCalledWith(firstTexture);
    const newTexture = test.gl.createTexture.mock.results[1].value;
    expect(test.gl.framebufferTexture2D).toHaveBeenLastCalledWith(20, 21, 10, newTexture, 0);
    expect(test.allocations.has(firstTexture)).toBe(false);
    expect(test.allocations.has(newTexture)).toBe(true);
  });

  it('cleans failed render targets and falls back rather than drawing incomplete framebuffers', () => {
    const test = setup({ completeFramebuffer: false });
    expect(test.container.dataset.darkVeilState).toBe('fallback');
    expect(test.gl.drawArrays).not.toHaveBeenCalled();
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
    test.scene!.destroy();
  });

  it('respects explicit DPR and caps oversized DPR and field resolution', () => {
    const test = setup();
    expect(test.canvas.width).toBe(1500);
    test.settings.dpr = 4;
    test.container.clientWidth = 4000;
    test.container.clientHeight = 2400;
    test.settings.quality = 1;
    test.scene!.refresh();
    expect(test.canvas.width).toBe(6000);
    expect(test.canvas.height).toBe(3600);
    const storage = test.gl.texStorage2D.mock.calls.at(-1)! as unknown as number[];
    expect(storage[3] * storage[4]).toBeLessThan(902000);
  });

  it('renders at most 30 frames per second despite faster RAF callbacks', () => {
    const test = setup();
    test.frame(100);
    const rendered = test.gl.drawArrays.mock.calls.length;
    test.frame(116);
    test.frame(132);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(rendered);
    test.frame(134);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(rendered + 2);
    expect(test.frames.size).toBe(1);
  });

  it('starts static for reduced motion and responds immediately to live preference changes', () => {
    const test = setup({ reduced: true });
    expect(test.container.dataset.darkVeilState).toBe('static');
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(2);
    expect(test.frames.size).toBe(0);
    test.motion(false);
    expect(test.frames.size).toBe(1);
    test.motion(true);
    expect(test.frames.size).toBe(0);
    expect(test.container.dataset.darkVeilState).toBe('static');
  });

  it('cancels work while hidden or offscreen and resumes only when both visible', () => {
    const test = setup();
    test.hidden(true);
    expect(test.frames.size).toBe(0);
    test.intersect(false);
    test.hidden(false);
    expect(test.frames.size).toBe(0);
    test.intersect(true);
    expect(test.frames.size).toBe(1);
    test.settings.paused = true;
    test.scene!.refresh();
    expect(test.frames.size).toBe(0);
    test.hidden(true); test.hidden(false);
    expect(test.frames.size).toBe(0);
  });

  it('does not draw or schedule an initially offscreen hero', () => {
    const test = setup({ offscreen: true });
    expect(test.frames.size).toBe(0);
    expect(test.gl.drawArrays).not.toHaveBeenCalled();
    test.intersect(true);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(2);
    expect(test.frames.size).toBe(1);
  });

  it('falls back on context loss and allocates fresh programs and textures on restoration', () => {
    const test = setup();
    const lateFrame = test.frames.values().next().value!;
    const draws = test.gl.drawArrays.mock.calls.length;
    const lost = new Event('webglcontextlost', { cancelable: true });
    test.canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(test.container.dataset.darkVeilState).toBe('fallback');
    expect(test.frames.size).toBe(0);
    lateFrame(100);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws);
    test.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(test.gl.createProgram).toHaveBeenCalledTimes(4);
    expect(test.gl.createTexture).toHaveBeenCalledTimes(2);
    expect(test.container.dataset.darkVeilState).toBe('animated');
    expect(test.frames.size).toBe(1);
  });

  it('supports React StrictMode setup-destroy-setup on the same canvas without losing its context', () => {
    const test = setup();
    test.scene!.destroy();
    expect(test.allocations.size).toBe(0);
    expect(test.loseContext).not.toHaveBeenCalled();
    const replay = createDarkVeilScene(
      test.container as unknown as HTMLDivElement,
      test.canvas as unknown as HTMLCanvasElement,
      () => test.settings,
    );
    expect(replay).not.toBeNull();
    expect(test.container.dataset.darkVeilState).toBe('animated');
    expect(test.frames.size).toBe(1);
    replay!.destroy();
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
  });
  it('removes subscriptions, frees resources and prevents stale callbacks after destroy', () => {
    const test = setup();
    const lateFrame = test.frames.values().next().value!;
    test.scene!.destroy();
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
    expect(test.resizeDisconnect).toHaveBeenCalledOnce();
    expect(test.intersectionDisconnect).toHaveBeenCalledOnce();
    const draws = test.gl.drawArrays.mock.calls.length;
    const programs = test.gl.createProgram.mock.calls.length;
    lateFrame(100); test.resize(); test.intersect(true); test.motion(false); test.hidden(false);
    test.canvas.dispatchEvent(new Event('webglcontextrestored'));
    test.scene!.refresh(); test.scene!.destroy();
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws);
    expect(test.gl.createProgram).toHaveBeenCalledTimes(programs);
    expect(test.frames.size).toBe(0);
  });
});

