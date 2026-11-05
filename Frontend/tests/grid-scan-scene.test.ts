import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGridScanScene, type GridScanSettings } from '../lib/visuals/grid-scan-scene';

const defaults: GridScanSettings = {
  linesColor: '#426276', scanColor: '#8bd6ee', cells: 8, thickness: 1, style: 0,
  depth: 3, depthFade: 0.6, parallax: 0.35, points: true, reflection: 0.25, shading: 0.7,
  direction: 'forward', duration: 3.2, delay: 1.8, scanWidth: 1, trail: 0.5, glow: 0.4,
  autoScan: true, intro: false, lightMode: false, paused: false, dpr: 1.25,
};

type Failures = { reduced?: boolean; hasContext?: boolean; failShader?: number; failTexture?: number;
  failBuffer?: number; incompleteFramebuffer?: number; offscreen?: boolean; maxTextureSize?: number };

function setup({ reduced = false, hasContext = true, failShader = 0, failTexture = 0, failBuffer = 0,
  incompleteFramebuffer = 0, offscreen = false, maxTextureSize = 4096 }: Failures = {}) {
  let serial = 0;
  let shaderNumber = 0;
  let textureNumber = 0;
  let bufferNumber = 0;
  let checkNumber = 0;
  let boundTexture: object | null = null;
  const allocations = new Set<object>();
  const allocate = () => { const resource = { id: ++serial }; allocations.add(resource); return resource; };
  const remove = vi.fn((resource: object | null) => { if (resource) allocations.delete(resource); });
  const uniforms = ['uTime', 'uScanZ', 'uScanDir', 'uScanAlpha', 'uReveal'];
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ACTIVE_UNIFORMS: 5,
    TEXTURE0: 6, TEXTURE1: 7, TEXTURE_2D: 8, RGBA8: 9, RGBA: 10, UNSIGNED_BYTE: 11,
    TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, LINEAR: 14, TEXTURE_WRAP_S: 15,
    TEXTURE_WRAP_T: 16, CLAMP_TO_EDGE: 17, FRAMEBUFFER: 18, COLOR_ATTACHMENT0: 19,
    COLOR_ATTACHMENT1: 20, FRAMEBUFFER_COMPLETE: 21, TRIANGLES: 22, BLEND: 23, MAX_TEXTURE_SIZE: 24,
    createShader: vi.fn(() => { shaderNumber++; return allocate(); }),
    getShaderParameter: vi.fn(() => shaderNumber !== failShader),
    getShaderInfoLog: vi.fn(() => 'Synthetic shader failure'), getProgramInfoLog: vi.fn(() => 'Synthetic link failure'),
    createProgram: vi.fn(allocate),
    getProgramParameter: vi.fn((_program: object, parameter: number) => parameter === 4 ? true : uniforms.length),
    getActiveUniform: vi.fn((_program: object, index: number) => ({ name: uniforms[index] })),
    getUniformLocation: vi.fn((_program: object, name: string) => name),
    createVertexArray: vi.fn(allocate),
    createFramebuffer: vi.fn(() => ++bufferNumber === failBuffer ? null : allocate()),
    createTexture: vi.fn(() => ++textureNumber === failTexture ? null : allocate()),
    deleteShader: remove, deleteProgram: remove, deleteVertexArray: remove, deleteFramebuffer: remove, deleteTexture: remove,
    bindTexture: vi.fn((_target: number, texture: object | null) => { boundTexture = texture; }),
    texImage2D: vi.fn((..._args: unknown[]) => { if (!boundTexture) throw new Error('Texture storage must be bound'); }),
    checkFramebufferStatus: vi.fn(() => ++checkNumber === incompleteFramebuffer ? 0 : 21),
    getParameter: vi.fn(() => maxTextureSize),
    shaderSource: vi.fn(), compileShader: vi.fn(), attachShader: vi.fn(), linkProgram: vi.fn(),
    bindVertexArray: vi.fn(), activeTexture: vi.fn(), texParameteri: vi.fn(), bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(), drawBuffers: vi.fn(), viewport: vi.fn(), disable: vi.fn(), useProgram: vi.fn(),
    uniform2f: vi.fn(), uniform3f: vi.fn(), uniform3fv: vi.fn(), uniform4f: vi.fn(), uniform4fv: vi.fn(), uniform1fv: vi.fn(),
    uniform1i: vi.fn(), uniform1f: vi.fn((_location: string, _value: number) => {}), drawArrays: vi.fn(),
  };
  const query = Object.assign(new EventTarget(), { matches: reduced });
  const window = Object.assign(new EventTarget(), { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3, matchMedia: () => query });
  const windowListen = vi.spyOn(window, 'addEventListener');
  const document = Object.assign(new EventTarget(), { hidden: false, createElement: vi.fn(() => ({ getContext: () => null })) });
  const container = {
    clientWidth: 1200, clientHeight: 700, dataset: {} as Record<string, string>,
    getBoundingClientRect: () => ({ top: offscreen ? 1000 : 0, bottom: offscreen ? 1700 : 700, left: 0, right: 1200 }),
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
    observe = vi.fn(); disconnect = resizeDisconnect;
  }
  class IntersectionObserver {
    constructor(callback: typeof intersectionCallback) { intersectionCallback = callback; }
    observe = vi.fn(); disconnect = intersectionDisconnect;
  }
  vi.stubGlobal('window', window); vi.stubGlobal('document', document);
  vi.stubGlobal('requestAnimationFrame', requestFrame); vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.stubGlobal('ResizeObserver', ResizeObserver); vi.stubGlobal('IntersectionObserver', IntersectionObserver);
  const settings = { ...defaults };
  const mount = () => createGridScanScene(container as unknown as HTMLDivElement, canvas as unknown as HTMLCanvasElement, () => settings);
  const scene = mount();
  return {
    scene, mount, gl, canvas, container, settings, frames, allocations, query, requestFrame,
    windowListen, document, resizeDisconnect, intersectionDisconnect,
    resize: () => resizeCallback(), intersect: (value: boolean) => intersectionCallback([{ isIntersecting: value }]),
    motion(value: boolean) { query.matches = value; query.dispatchEvent(new Event('change')); },
    hidden(value: boolean) { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
    frame(timestamp: number) {
      const entry = frames.entries().next().value;
      if (!entry) throw new Error('Expected scheduled animation frame');
      frames.delete(entry[0]); entry[1](timestamp);
    },
    loseContext() {
      allocations.clear(); // The browser invalidates all objects belonging to a lost context.
      const event = new Event('webglcontextlost', { cancelable: true });
      canvas.dispatchEvent(event); return event;
    },
  };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('GridScan decorative renderer', () => {
  it('uses CSS fallback without GPU allocations when WebGL2 is unavailable', () => {
    const test = setup({ hasContext: false });
    expect(test.scene).toBeNull();
    expect(test.container.dataset.gridScanState).toBe('fallback');
    expect(test.container.dataset.gridScanError).toBe('webgl-unavailable');
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
  });

  it.each([{ failShader: 6 }, { failTexture: 3 }, { failBuffer: 2 }])('releases partial resources when initialization fails: %j', (failure) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const test = setup(failure);
    expect(test.scene).toBeNull();
    expect(test.allocations.size).toBe(0);
    expect(test.gl.drawArrays).not.toHaveBeenCalled();
    expect(test.container.dataset.gridScanError).toBe('gpu-resource-initialization');
  });

  it('rejects an incomplete bloom framebuffer before drawing and cleans every allocation', () => {
    const test = setup({ incompleteFramebuffer: 2 });
    expect(test.container.dataset.gridScanState).toBe('fallback');
    expect(test.container.dataset.gridScanError).toBe('framebuffer-incomplete');
    expect(test.gl.drawArrays).not.toHaveBeenCalled();
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
    test.scene!.destroy();
  });

  it('resizes all four render targets while preserving resources and avoiding redundant allocations', () => {
    const test = setup();
    expect(test.gl.texImage2D).toHaveBeenCalledTimes(4);
    const resources = [...test.allocations];
    test.resize();
    expect(test.gl.texImage2D).toHaveBeenCalledTimes(4);
    test.container.clientWidth = 390; test.container.clientHeight = 844;
    test.resize();
    expect(test.gl.texImage2D).toHaveBeenCalledTimes(8);
    expect([...test.allocations]).toEqual(resources);
    expect(test.gl.createTexture).toHaveBeenCalledTimes(4);
    expect(test.canvas.width).toBe(487);
    expect(test.canvas.height).toBe(1055);
  });

  it('caps large viewport DPR, total pixel count and device texture dimensions', () => {
    const test = setup({ maxTextureSize: 2048 });
    test.container.clientWidth = 5000; test.container.clientHeight = 3000; test.settings.dpr = 4;
    test.scene!.refresh();
    expect(test.canvas.width * test.canvas.height).toBeLessThanOrEqual(1_600_000);
    expect(Math.max(test.canvas.width, test.canvas.height)).toBeLessThanOrEqual(2048);
    test.container.clientWidth = 390; test.container.clientHeight = 844; test.scene!.refresh();
    expect(test.canvas.width).toBe(585);
    expect(test.canvas.height).toBe(1266);
  });

  it('limits the five-pass shader pipeline to at most 30 rendered frames per second', () => {
    const test = setup();
    test.frame(100);
    const draws = test.gl.drawArrays.mock.calls.length;
    test.frame(116); test.frame(132);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws);
    test.frame(134);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws + 5);
    expect(test.frames.size).toBe(1);
  });

  it('draws a still grid for reduced motion and handles preference changes live', () => {
    const test = setup({ reduced: true });
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(5);
    expect(test.container.dataset.gridScanState).toBe('static');
    expect(test.frames.size).toBe(0);
    test.motion(false);
    expect(test.frames.size).toBe(1);
    test.motion(true);
    expect(test.frames.size).toBe(0);
    expect(test.container.dataset.gridScanState).toBe('static');
  });

  it('suspends hidden/offscreen work immediately and resumes only with both visible', () => {
    const test = setup();
    test.hidden(true); const draws = test.gl.drawArrays.mock.calls.length;
    expect(test.frames.size).toBe(0);
    test.container.clientWidth = 390; test.resize();
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws);
    test.intersect(false); test.hidden(false);
    expect(test.frames.size).toBe(0);
    test.intersect(true);
    expect(test.frames.size).toBe(1);
    test.settings.paused = true; test.scene!.refresh(); test.hidden(true); test.hidden(false);
    expect(test.frames.size).toBe(0);
  });

  it('does not draw or allocate render storage for an initially offscreen canvas', () => {
    const test = setup({ offscreen: true });
    expect(test.frames.size).toBe(0);
    expect(test.gl.drawArrays).not.toHaveBeenCalled();
    expect(test.gl.texImage2D).not.toHaveBeenCalled();
    test.intersect(true);
    expect(test.gl.texImage2D).toHaveBeenCalledTimes(4);
    expect(test.frames.size).toBe(1);
  });

  it('supports forward, backward and alternating scan travel from the supplied settings', () => {
    const test = setup();
    test.settings.direction = 'pingpong'; test.settings.delay = 0; test.settings.duration = 0.3;
    for (let now = 100; now <= 1000; now += 40) test.frame(now);
    const directions = test.gl.uniform1f.mock.calls.filter(([location]) => location === 'uScanDir').map(([, value]) => value);
    expect(directions).toContain(1);
    expect(directions).toContain(-1);
    const strengths = test.gl.uniform1f.mock.calls.filter(([location]) => location === 'uScanAlpha').map(([, value]) => value);
    expect(strengths.some((value) => value > 0)).toBe(true);
    expect(strengths.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('falls back during context loss and rebuilds fresh resources after restoration', () => {
    const test = setup();
    const lateFrame = test.frames.values().next().value!;
    const draws = test.gl.drawArrays.mock.calls.length;
    expect(test.loseContext().defaultPrevented).toBe(true);
    expect(test.container.dataset.gridScanState).toBe('fallback');
    lateFrame(100);
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws);
    expect(test.frames.size).toBe(0);
    test.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(test.gl.createProgram).toHaveBeenCalledTimes(8);
    expect(test.gl.createTexture).toHaveBeenCalledTimes(8);
    expect(test.container.dataset.gridScanState).toBe('animated');
    expect(test.container.dataset.gridScanError).toBeUndefined();
    test.scene!.destroy();
    expect(test.allocations.size).toBe(0);
  });

  it('survives StrictMode setup-destroy-setup using the same canvas', () => {
    const test = setup(); test.scene!.destroy();
    expect(test.allocations.size).toBe(0);
    const replay = test.mount();
    expect(replay).not.toBeNull();
    expect(test.container.dataset.gridScanState).toBe('animated');
    expect(test.frames.size).toBe(1);
    replay!.destroy();
    expect(test.allocations.size).toBe(0);
    expect(test.frames.size).toBe(0);
  });

  it('removes observers/subscriptions and ignores stale work after cleanup', () => {
    const test = setup(); const lateFrame = test.frames.values().next().value!;
    test.scene!.destroy();
    expect(test.resizeDisconnect).toHaveBeenCalledOnce(); expect(test.intersectionDisconnect).toHaveBeenCalledOnce();
    const draws = test.gl.drawArrays.mock.calls.length;
    lateFrame(100); test.resize(); test.intersect(true); test.motion(false); test.hidden(false);
    test.canvas.dispatchEvent(new Event('webglcontextrestored')); test.scene!.refresh();
    expect(test.gl.drawArrays).toHaveBeenCalledTimes(draws);
    expect(test.frames.size).toBe(0);
    expect(test.allocations.size).toBe(0);
  });

  it('contains no permission prompts, remote loaders or sensor listeners in the decorative path', () => {
    const test = setup();
    expect(test.windowListen.mock.calls.map(([event]) => event)).toEqual(['resize']);
    const source = ['components/grid-scan.tsx', 'lib/visuals/grid-scan-scene.ts']
      .map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n');
    expect(source).not.toMatch(/getUserMedia|mediaDevices|DeviceOrientation|requestPermission|faceapi|face-api|cdn\.jsdelivr|fetch\s*\(/);
  });
});
