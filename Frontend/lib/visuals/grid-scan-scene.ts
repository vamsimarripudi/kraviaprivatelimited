// Adapted from the user-supplied GridScan implementation, Pasted text.txt.
// Source SHA-256: d5245bbd0098892f8967184eab4e04a7c9edd60087674044be28f2de0da42cbf.
// The supplied VERTEX, ROOM, DOWN, BLUR and COMPOSITE shaders are retained unchanged.
// Related third-party attribution: ../../third-party/react-bits-LICENSE.md.
// This decorative renderer uses only local graphics; no device sensors or network resources.

export interface GridScanSettings {
  linesColor: string;
  scanColor: string;
  cells: number;
  thickness: number;
  style: 0 | 1 | 2;
  depth: number;
  depthFade: number;
  parallax: number;
  points: boolean;
  reflection: number;
  shading: number;
  direction: 'forward' | 'backward' | 'pingpong';
  duration: number;
  delay: number;
  scanWidth: number;
  trail: number;
  glow: number;
  autoScan: boolean;
  intro: boolean;
  lightMode: boolean;
  paused: boolean;
  dpr: number;
}

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
type Target = { texture: WebGLTexture; width: number; height: number };
type Resources = {
  room: Program; down: Program; blur: Program; composite: Program;
  vao: WebGLVertexArrayObject;
  scene: Target; light: Target; bloomA: Target; bloomB: Target;
  sceneBuffer: WebGLFramebuffer; bloomBufferA: WebGLFramebuffer; bloomBufferB: WebGLFramebuffer;
};

const INTRO_SECONDS = 2.2;
const EYE_DISTANCE = 1.25;
const MAX_RENDER_PIXELS = 1_600_000;
const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const ROOM = `#version 300 es
precision highp float;
precision highp int;
uniform float uAspect;
uniform float uPixel;
uniform vec3 uEye;
uniform float uDepth;
uniform vec3 uCell;
uniform float uThick;
uniform float uDot;
uniform int uStyle;
uniform vec3 uLineColor;
uniform vec3 uScanColor;
uniform vec3 uCoreColor;
uniform float uFade;
uniform float uScanZ;
uniform float uScanDir;
uniform float uScanAlpha;
uniform float uScanWidth;
uniform float uTrail;
uniform float uReveal;
uniform float uPoints;
uniform float uReflect;
uniform float uHaze;
uniform float uShade;
uniform float uLight;
uniform vec4 uPing[4];
uniform float uPingAlpha[4];
uniform vec4 uHover;
uniform float uTime;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlow;

struct Light {
  float grid;
  float fade;
  float core;
  float trail;
  float spill;
  float ping;
  float wake;
  float reveal;
};

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 hash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float lines(float across, float along, float period, float dash, float fa, float fb) {
  float u = across / period;
  float du = fa / period;
  float d = abs(fract(u + 0.5) - 0.5) / max(du, 1e-5);
  float dense = smoothstep(0.1, 0.4, du);
  if (uStyle == 2) {
    float c = along / dash * 5.0;
    float dc = fb / dash * 5.0;
    float e = abs(fract(c + 0.5) - 0.5) / max(dc, 1e-5);
    float cov = clamp(uThick + 1.0 - length(vec2(d, e)), 0.0, 1.0);
    float mean = min(1.0, 3.1416 * (uThick + 0.5) * (uThick + 0.5) * du * dc);
    return mix(cov, mean, max(dense, smoothstep(0.1, 0.4, dc)));
  }
  float cov = clamp(uThick + 0.5 - d, 0.0, 1.0);
  float mean = min(1.0, 2.0 * uThick * du);
  if (uStyle == 1) {
    float c = along / dash * 4.0;
    float dc = fb / dash * 4.0;
    float e = abs(fract(c + 0.5) - 0.5);
    float m = clamp((0.25 - e) / max(dc, 1e-5) + 0.5, 0.0, 1.0);
    cov *= mix(m, 0.5, smoothstep(0.1, 0.4, dc));
    mean *= 0.5;
  }
  return mix(cov, mean, dense);
}

float depthFade(float z) {
  float n = clamp(z / uDepth, 0.0, 1.0);
  return mix(1.0, (exp(-3.0 * n) - 0.0497871) / 0.9502129, uFade);
}

vec3 project(vec3 eye, vec3 o, int face, float plane) {
  vec3 d = o - eye;
  float t = face == 0 ? (plane - o.x) / d.x : (face == 1 ? (plane - o.y) / d.y : (plane - o.z) / d.z);
  return o + d * t;
}

void trace(vec3 o, vec3 d, out int face, out float plane, out vec3 h) {
  float sx = d.x > 0.0 ? 0.5 * uAspect : -0.5 * uAspect;
  float sy = d.y > 0.0 ? 0.5 : -0.5;
  float tx = abs(d.x) > 1e-6 ? (sx - o.x) / d.x : 1e9;
  float ty = abs(d.y) > 1e-6 ? (sy - o.y) / d.y : 1e9;
  float t = (uDepth - o.z) / d.z;
  face = 2;
  plane = uDepth;
  if (tx < t) {
    face = 0;
    plane = sx;
    t = tx;
  }
  if (ty < t) {
    face = 1;
    plane = sy;
    t = ty;
  }
  h = o + d * t;
}

vec2 faceUv(vec3 h, int face) {
  if (face == 0) return vec2(h.z, h.y + 0.5);
  if (face == 1) return vec2(h.x + 0.5 * uAspect, h.z);
  return vec2(h.x + 0.5 * uAspect, h.y + 0.5);
}

Light illuminate(vec3 h, int face, vec2 uv, vec2 foot, float blur) {
  Light l;
  vec2 cell = face == 0 ? uCell.zy : (face == 1 ? uCell.xz : uCell.xy);
  vec2 f = foot * blur;
  float minor = max(lines(uv.x, uv.y, cell.x, cell.y, f.x, f.y), lines(uv.y, uv.x, cell.y, cell.x, f.y, f.x));
  float major = max(
    lines(uv.x, uv.y, cell.x * 4.0, cell.y, f.x, f.y),
    lines(uv.y, uv.x, cell.y * 4.0, cell.x, f.y, f.x)
  );
  l.grid = max(minor * 0.75, major) / blur;
  float z = h.z;
  l.fade = depthFade(z);
  l.reveal = smoothstep(uReveal, uReveal - 0.2, z);
  float zFoot = face == 0 ? f.x : (face == 1 ? f.y : 0.0);
  float width = max(uScanWidth, zFoot * 1.1);
  float dz = z - uScanZ;
  l.core = exp(-dz * dz / (width * width)) * (face == 2 ? 0.45 : 1.0) * uScanAlpha;
  float behind = -dz * uScanDir;
  l.trail = exp(-max(behind, 0.0) / uTrail) * smoothstep(-width, width * 0.5, behind) * uScanAlpha;
  l.spill = exp(-dz * dz / 0.05) * uScanAlpha;
  l.ping = 0.0;
  l.wake = 0.0;
  for (int i = 0; i < 4; i++) {
    float alpha = uPingAlpha[i];
    if (alpha <= 0.0) continue;
    float dist = length(h - uPing[i].xyz) - uPing[i].w;
    l.ping += exp(-dist * dist / 0.0012) * alpha;
    l.wake += exp(min(dist, 0.0) / 0.22) * smoothstep(0.03, -0.03, dist) * alpha;
  }
  return l;
}

void over(inout vec4 acc, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  acc = vec4(color * alpha, alpha) + acc * (1.0 - alpha);
}

void paint(inout vec4 color, inout float energy, Light l, float gain, float lift, float hover) {
  float base = l.grid * l.fade * l.reveal * lift;
  float far = l.fade * l.reveal * gain;
  float lit = l.grid * (l.core * 1.2 + l.trail * 0.75 + l.ping * 1.4 + l.wake * 0.5 + hover * 0.5) * far;
  float sheen = (l.core * 0.14 + l.spill * 0.05 + l.trail * 0.03 + l.ping * 0.2 + l.wake * 0.04) * far;
  float laser = (l.core + l.ping * 0.35) * far;
  over(color, uLineColor, base);
  over(color, uScanColor, sheen);
  over(color, uScanColor, lit);
  over(color, uCoreColor, laser * 0.9);
  energy += laser * 0.9 + lit * 0.5;
}

void main() {
  vec3 p = vec3((vUv.x - 0.5) * uAspect, vUv.y - 0.5, 0.0);
  vec3 d = p - uEye;
  int face;
  float plane;
  vec3 h;
  trace(p, d, face, plane, h);
  vec3 hx = project(uEye, p + vec3(uPixel, 0.0, 0.0), face, plane);
  vec3 hy = project(uEye, p + vec3(0.0, uPixel, 0.0), face, plane);
  vec2 uv = faceUv(h, face);
  vec2 ux = faceUv(hx, face) - uv;
  vec2 uy = faceUv(hy, face) - uv;
  vec2 foot = vec2(length(vec2(ux.x, uy.x)), length(vec2(ux.y, uy.y)));
  Light l = illuminate(h, face, uv, foot, 1.0);

  vec4 color = vec4(0.0);
  float energy = 0.0;

  if (uShade > 0.0) {
    vec2 gaps = face == 0
      ? vec2(0.5 - abs(h.y), uDepth - h.z)
      : (face == 1 ? vec2(0.5 * uAspect - abs(h.x), uDepth - h.z) : vec2(0.5 * uAspect - abs(h.x), 0.5 - abs(h.y)));
    vec2 crease = 1.0 - exp(-max(gaps, 0.0) / 0.16);
    float occlusion = crease.x * crease.y;
    float lamp = 1.0 / (1.0 + h.z * h.z * 0.9);
    float tilt = face == 1 ? (plane < 0.0 ? 1.1 : 0.85) : (face == 2 ? 0.8 : 1.0);
    float glowSpill = (l.spill * 0.5 + l.trail * 0.12) * l.reveal * l.fade;
    if (uLight > 0.5) {
      float shadow = (1.0 - lamp * tilt) * 0.09 + (1.0 - occlusion) * 0.2;
      over(color, vec3(0.0), shadow * uShade * l.reveal * l.fade);
    } else {
      over(color, vec3(1.0), lamp * tilt * occlusion * 0.11 * uShade * l.reveal * l.fade);
    }
    over(color, uScanColor, glowSpill * uShade * occlusion * 0.35);
  }

  if (face == 1 && plane < 0.0 && uReflect > 0.0) {
    vec3 mirror = vec3(uEye.x, -1.0 - uEye.y, uEye.z);
    vec3 r = h - mirror;
    int face2;
    float plane2;
    vec3 h2;
    trace(h, r, face2, plane2, h2);
    vec2 uv2 = faceUv(h2, face2);
    vec2 ux2 = faceUv(project(mirror, hx, face2, plane2), face2) - uv2;
    vec2 uy2 = faceUv(project(mirror, hy, face2, plane2), face2) - uv2;
    vec2 foot2 = vec2(length(vec2(ux2.x, uy2.x)), length(vec2(ux2.y, uy2.y)));
    float travel = length(h2 - h);
    Light m = illuminate(h2, face2, uv2, foot2, 1.0 + travel * 4.0);
    m.reveal *= l.reveal;
    float grazing = 1.0 - normalize(r).y;
    float gain = (0.3 + 0.7 * grazing * grazing * grazing * grazing) * uReflect * exp(-travel * 1.1) * (uLight > 0.5 ? 0.6 : 1.0);
    float reflected = 0.0;
    paint(color, reflected, m, gain, 0.0, 0.0);
    energy += reflected * 0.6;
  }

  vec3 near = h - uHover.xyz;
  float hover = exp(-dot(near, near) / 0.08) * uHover.w;
  paint(color, energy, l, 1.0, 1.0, hover);

  if (uPoints > 0.5) {
    vec2 cell = face == 0 ? uCell.zy : (face == 1 ? uCell.xz : uCell.xy);
    vec2 spacing = cell / 2.5;
    vec2 q = uv / spacing;
    vec2 id = floor(q);
    vec2 seed = id + vec2(float(face) * 13.7 + plane * 5.3, float(face) * 3.1);
    vec2 delta = (q - id - (0.2 + 0.6 * hash2(seed))) * spacing;
    float det = ux.x * uy.y - ux.y * uy.x;
    vec2 s = vec2(delta.x * uy.y - delta.y * uy.x, ux.x * delta.y - ux.y * delta.x) / det;
    float radius = uDot * mix(1.0, 0.55, clamp(h.z / uDepth, 0.0, 1.0));
    float spot = clamp(radius + 0.5 - length(s), 0.0, 1.0);
    float gap = min(spacing.x / foot.x, spacing.y / foot.y);
    float r = hash(seed + 7.7);
    float flicker = 0.75 + 0.25 * sin(uTime * (3.0 + r * 5.0) + r * 40.0);
    float dots = spot * smoothstep(5.0, 10.0, gap) * smoothstep(0.25, 0.6, r) * (0.3 + 0.7 * r * r) * flicker;
    float hot = l.core * 2.5 + l.ping * 1.6;
    float warm = l.trail * l.trail * 1.3 + l.wake * 0.6 + hover * 1.3;
    float spark = dots * (hot + warm) * l.fade * l.reveal;
    over(color, mix(uScanColor, uCoreColor, clamp(hot / max(hot + warm, 1e-4), 0.0, 1.0)), spark);
    energy += spark * 0.9;
  }

  if (uHaze > 0.0 && uScanAlpha > 0.0 && uScanZ > 0.0 && h.z > uScanZ) {
    vec3 c = p + d * (uScanZ / d.z);
    float grain = hash(floor(c.xy * 180.0) + floor(uTime * 24.0) * 7.0);
    float edge = min(0.5 * uAspect - abs(c.x), 0.5 - abs(c.y));
    float rim = exp(-edge / 0.06);
    float veil = uHaze * uScanAlpha * (0.45 + 0.9 * grain) * (0.55 + rim * 1.6);
    over(color, uScanColor, veil * depthFade(uScanZ) * l.reveal);
  }

  energy = clamp(energy, 0.0, 1.0);
  outColor = color;
  outGlow = vec4(uScanColor * energy, energy);
}`;

const DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 o = uTexel;
  outColor = 0.25 * (
    texture(uSource, vUv + vec2(-o.x, -o.y)) +
    texture(uSource, vUv + vec2(o.x, -o.y)) +
    texture(uSource, vUv + vec2(-o.x, o.y)) +
    texture(uSource, vUv + vec2(o.x, o.y))
  );
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.1964825501511404;
  sum += (texture(uSource, vUv + uStep * 1.411764705882353) + texture(uSource, vUv - uStep * 1.411764705882353)) * 0.2969069646728344;
  sum += (texture(uSource, vUv + uStep * 3.2941176470588234) + texture(uSource, vUv - uStep * 3.2941176470588234)) * 0.09447039785044732;
  sum += (texture(uSource, vUv + uStep * 5.176470588235294) + texture(uSource, vUv - uStep * 5.176470588235294)) * 0.010381362401148057;
  outColor = sum;
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uGlow;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  vec4 scene = texture(uScene, vUv);
  vec4 bloom = texture(uBloom, vUv) * uGlow;
  bloom.a = min(bloom.a, 1.0);
  bloom.rgb = min(bloom.rgb, vec3(bloom.a));
  vec4 color = scene + bloom * (1.0 - scene.a);
  float noise = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  color.a = clamp(color.a + noise, 0.0, 1.0);
  color.rgb = clamp(color.rgb + noise, vec3(0.0), vec3(color.a));
  outColor = color;
}`;


const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  if (process.env.NODE_ENV !== 'production') console.warn('[GridScan] Shader compilation failed:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext, source: string): Program | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = vertex ? compile(gl, gl.FRAGMENT_SHADER, source) : null;
  const program = fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== 'production') console.warn('[GridScan] Program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Program['uniforms'] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function createTarget(gl: WebGL2RenderingContext): Target | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, width: 0, height: 0 };
}

function sizeTarget(gl: WebGL2RenderingContext, target: Target, width: number, height: number) {
  if (target.width === width && target.height === height) return;
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
  // Mutable storage may be resized without reusing an immutable texStorage2D allocation.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  target.width = width;
  target.height = height;
}

/** Local decorative graphics only; this owner never requests browser permissions. */
export function createGridScanScene(container: HTMLDivElement, canvas: HTMLCanvasElement, readSettings: () => GridScanSettings) {
  let gl: WebGL2RenderingContext;
  try {
    const context = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'low-power',
    });
    if (!context) {
      container.dataset.gridScanState = 'fallback';
      container.dataset.gridScanError = 'webgl-unavailable';
      return null;
    }
    gl = context;
  } catch {
    container.dataset.gridScanState = 'fallback';
    container.dataset.gridScanError = 'webgl-context';
    return null;
  }

  let resources: Resources | null = null;
  let disposed = false;
  let contextLost = false;
  let raf = 0;
  let last = 0;
  const bounds = container.getBoundingClientRect();
  let visible = bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery?.matches ?? true;
  const view = { width: 1, height: 1, ratio: 1 };
  const eye = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, f: EYE_DISTANCE };
  const scan = { z: 0, dir: 1, alpha: 0, start: 0, sweeps: 0, waiting: false };
  // The supplied shader retains its optional ping uniforms; decorative mode leaves them zero.
  const pingData = new Float32Array(16);
  const pingAlpha = new Float32Array(4);
  let time = 0;
  let introClock = readSettings().intro && !reduced ? 0 : 1;
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const colorCache = new Map<string, number[]>();
  const parse = (value: string): number[] => {
    const cached = colorCache.get(value);
    if (cached) return cached;
    let rgb = [1, 1, 1];
    if (probe) {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = '#000000';
      probe.fillStyle = value;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      rgb = [r / 255, g / 255, b / 255];
    }
    colorCache.set(value, rgb);
    return rgb;
  };

  const release = () => {
    if (!resources) return;
    const { room, down, blur, composite, vao, scene, light, bloomA, bloomB, sceneBuffer, bloomBufferA, bloomBufferB } = resources;
    [scene, light, bloomA, bloomB].forEach((target) => gl.deleteTexture(target.texture));
    [sceneBuffer, bloomBufferA, bloomBufferB].forEach((buffer) => gl.deleteFramebuffer(buffer));
    [room, down, blur, composite].forEach((program) => gl.deleteProgram(program.program));
    gl.deleteVertexArray(vao);
    resources = null;
  };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; };
  const fail = (reason: string) => {
    stop(); release();
    container.dataset.gridScanState = 'fallback';
    container.dataset.gridScanError = reason;
  };

  const initialize = () => {
    const programs: Program[] = [];
    const targets: Target[] = [];
    const buffers: WebGLFramebuffer[] = [];
    let vao: WebGLVertexArrayObject | null = null;
    const abandon = () => {
      programs.forEach((program) => gl.deleteProgram(program.program));
      targets.forEach((target) => gl.deleteTexture(target.texture));
      buffers.forEach((buffer) => gl.deleteFramebuffer(buffer));
      if (vao) gl.deleteVertexArray(vao);
      return false;
    };
    for (const shader of [ROOM, DOWN, BLUR, COMPOSITE]) {
      const program = link(gl, shader);
      if (!program) return abandon();
      programs.push(program);
    }
    vao = gl.createVertexArray();
    if (!vao) return abandon();
    for (let i = 0; i < 4; i++) {
      const target = createTarget(gl);
      if (!target) return abandon();
      targets.push(target);
    }
    for (let i = 0; i < 3; i++) {
      const buffer = gl.createFramebuffer();
      if (!buffer) return abandon();
      buffers.push(buffer);
    }
    resources = {
      room: programs[0], down: programs[1], blur: programs[2], composite: programs[3], vao,
      scene: targets[0], light: targets[1], bloomA: targets[2], bloomB: targets[3],
      sceneBuffer: buffers[0], bloomBufferA: buffers[1], bloomBufferB: buffers[2],
    };
    delete container.dataset.gridScanError;
    return true;
  };

  const resizeTargets = () => {
    if (!resources) return false;
    const { scene, light, bloomA, bloomB, sceneBuffer, bloomBufferA, bloomBufferB } = resources;
    if (scene.width === canvas.width && scene.height === canvas.height) return true;
    gl.activeTexture(gl.TEXTURE0);
    sizeTarget(gl, scene, canvas.width, canvas.height);
    sizeTarget(gl, light, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scene.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, light.texture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;
    const width = Math.max(1, Math.round(canvas.width / 4));
    const height = Math.max(1, Math.round(canvas.height / 4));
    for (const [target, buffer] of [[bloomA, bloomBufferA], [bloomB, bloomBufferB]] as const) {
      sizeTarget(gl, target, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  };

  const roomSize = () => {
    const s = readSettings();
    const aspect = view.width / view.height;
    const cy = 1 / Math.round(s.cells);
    const cx = aspect / Math.max(1, Math.round(aspect / cy));
    const roomDepth = Math.max(cy, Math.round(s.depth / cy) * cy);
    return { aspect, cx, cy, roomDepth };
  };
  const startSweep = (s: GridScanSettings) => {
    scan.dir = s.direction === 'backward' || (s.direction === 'pingpong' && scan.sweeps % 2 === 1) ? -1 : 1;
    scan.start = time;
    scan.waiting = false;
    scan.sweeps += 1;
  };
  const updateScan = (s: GridScanSettings, roomDepth: number) => {
    if (introClock < 1) {
      const k = introClock;
      scan.dir = 1;
      scan.z = k * (roomDepth + 0.4) - 0.2;
      scan.alpha = Math.min(1, k * 6) * (1 - Math.max(0, k - 0.85) / 0.15);
      return;
    }
    if (scan.sweeps === 0 && !scan.waiting) { scan.waiting = true; scan.start = time; scan.alpha = 0; }
    if (scan.waiting) {
      scan.alpha = 0;
      if (s.autoScan && !reduced && time - scan.start >= s.delay) startSweep(s);
      return;
    }
    const k = (time - scan.start) / s.duration;
    if (k >= 1) { scan.waiting = true; scan.start = time; scan.alpha = 0; return; }
    const travel = k * (roomDepth + 0.3) - 0.15;
    scan.z = scan.dir > 0 ? travel : roomDepth - travel;
    scan.alpha = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.12);
  };
  const aimEye = (s: GridScanSettings) => {
    const aspect = view.width / view.height;
    const nx = Math.sin(time * 0.21) * 0.2 + Math.sin(time * 0.083 + 1.3) * 0.12;
    const ny = Math.sin(time * 0.17 + 2.1) * 0.16;
    eye.tx = nx * s.parallax * 0.22 * aspect;
    eye.ty = ny * s.parallax * 0.22;
  };
  const updateEye = (dt: number) => {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      eye.vx += ((eye.tx - eye.x) * 42 - eye.vx * 11) * h;
      eye.vy += ((eye.ty - eye.y) * 42 - eye.vy * 11) * h;
      eye.x += eye.vx * h;
      eye.y += eye.vy * h;
    }
  };
    const draw = () => {
      if (disposed || contextLost || !resources || !visible || document.hidden) return;
      if (!resizeTargets()) { fail('framebuffer-incomplete'); return; }
      const { room, down, blur, composite, vao, scene, light, bloomA, bloomB, sceneBuffer, bloomBufferA, bloomBufferB } = resources;
      const s = readSettings();
      const { aspect, cx, cy, roomDepth } = roomSize();
      const lineRgb = parse(s.linesColor);
      const scanRgb = parse(s.scanColor);
      const coreRgb = s.lightMode ? scanRgb : scanRgb.map(c => c + (1 - c) * 0.65);
      const ru = room.uniforms;
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneBuffer);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(room.program);
      gl.uniform1f(ru.uAspect, aspect);
      gl.uniform1f(ru.uPixel, 1 / canvas.height);
      gl.uniform3f(ru.uEye, eye.x, eye.y, -eye.f);
      gl.uniform1f(ru.uDepth, roomDepth);
      gl.uniform3f(ru.uCell, cx, cy, cy);
      gl.uniform1f(ru.uThick, s.thickness * view.ratio * 0.5);
      gl.uniform1f(ru.uDot, 1.8 * view.ratio);
      gl.uniform1i(ru.uStyle, s.style);
      gl.uniform3fv(ru.uLineColor, lineRgb);
      gl.uniform3fv(ru.uScanColor, scanRgb);
      gl.uniform3fv(ru.uCoreColor, coreRgb);
      gl.uniform1f(ru.uFade, s.depthFade);
      gl.uniform1f(ru.uScanZ, scan.z);
      gl.uniform1f(ru.uScanDir, scan.dir);
      gl.uniform1f(ru.uScanAlpha, scan.alpha);
      gl.uniform1f(ru.uScanWidth, 0.006 * s.scanWidth);
      gl.uniform1f(ru.uTrail, 0.04 + s.trail * 1.1);
      gl.uniform1f(ru.uReveal, introClock < 1 ? scan.z + 0.05 : 1e4);
      gl.uniform1f(ru.uPoints, s.points ? 1 : 0);
      gl.uniform1f(ru.uReflect, s.reflection);
      gl.uniform1f(ru.uHaze, s.lightMode ? 0.03 : 0.05);
      gl.uniform1f(ru.uShade, s.shading);
      gl.uniform1f(ru.uLight, s.lightMode ? 1 : 0);
      gl.uniform4fv(ru.uPing, pingData);
      gl.uniform1fv(ru.uPingAlpha, pingAlpha);
      gl.uniform4f(ru.uHover, 0, 0, 0, 0);
      gl.uniform1f(ru.uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const glowing = s.glow > 0;
      if (glowing) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomBufferA);
        gl.viewport(0, 0, bloomA.width, bloomA.height);
        gl.useProgram(down.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, light.texture);
        gl.uniform1i(down.uniforms.uSource, 0);
        gl.uniform2f(down.uniforms.uTexel, 1 / light.width, 1 / light.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const spread = (2.2 * view.ratio) / 2;
        gl.useProgram(blur.program);
        gl.uniform1i(blur.uniforms.uSource, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomBufferB);
        gl.bindTexture(gl.TEXTURE_2D, bloomA.texture);
        gl.uniform2f(blur.uniforms.uStep, spread / bloomA.width, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomBufferA);
        gl.bindTexture(gl.TEXTURE_2D, bloomB.texture);
        gl.uniform2f(blur.uniforms.uStep, 0, spread / bloomA.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(composite.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.uniform1i(composite.uniforms.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloomA.texture);
      gl.uniform1i(composite.uniforms.uBloom, 1);
      gl.uniform1f(composite.uniforms.uGlow, glowing ? s.glow * (s.lightMode ? 0.8 : 1.6) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);
    };



  const canAnimate = () => !disposed && !contextLost && !!resources && visible && !document.hidden && !reduced && !readSettings().paused;
  const frame = (now: number) => {
    raf = 0;
    if (!canAnimate()) return;
    if (last && now - last < 1000 / 30) { raf = requestAnimationFrame(frame); return; }
    const dt = last ? clamp((now - last) / 1000, 0.001, 0.05) : 1 / 30;
    last = now;
    time += dt;
    const s = readSettings();
    if (!s.intro) introClock = 1;
    else if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
    updateScan(s, roomSize().roomDepth);
    aimEye(s);
    updateEye(dt);
    draw();
    const settling = Math.abs(eye.tx - eye.x) + Math.abs(eye.ty - eye.y) + Math.abs(eye.vx) + Math.abs(eye.vy) > 1e-4;
    const busy = introClock < 1 || s.autoScan || !scan.waiting || s.parallax > 0 || settling;
    if (canAnimate() && busy) raf = requestAnimationFrame(frame);
    else { last = 0; if (resources) container.dataset.gridScanState = 'static'; }
  };
  const synchronize = () => {
    stop();
    if (disposed || contextLost || !resources) return;
    if (!visible || document.hidden) { container.dataset.gridScanState = 'suspended'; return; }
    const staticMotion = reduced || readSettings().paused;
    if (staticMotion) introClock = 1;
    container.dataset.gridScanState = staticMotion ? 'static' : 'animated';
    draw();
    if (canAnimate()) raf = requestAnimationFrame(frame);
  };
  const resize = () => {
    if (disposed || contextLost || !resources) return;
    const s = readSettings();
    view.width = Math.max(1, container.clientWidth);
    view.height = Math.max(1, container.clientHeight);
    const maximum = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
    view.ratio = Math.min(clamp(s.dpr || window.devicePixelRatio || 1, 0.5, 1.5),
      Math.sqrt(MAX_RENDER_PIXELS / (view.width * view.height)), maximum / view.width, maximum / view.height);
    const width = Math.max(1, Math.floor(view.width * view.ratio));
    const height = Math.max(1, Math.floor(view.height * view.ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    synchronize();
  };
  const onMotionChange = () => { reduced = motionQuery?.matches ?? true; synchronize(); };
  const onContextLost = (event: Event) => {
    event.preventDefault(); contextLost = true; stop();
    resources = null; // Lost contexts have invalidated all owned GPU objects.
    container.dataset.gridScanState = 'fallback';
    container.dataset.gridScanError = 'context-lost';
  };
  const onContextRestored = () => {
    if (disposed) return;
    contextLost = false;
    if (!initialize()) { fail('gpu-resource-initialization'); return; }
    resize();
  };
  if (!initialize()) { fail('gpu-resource-initialization'); return null; }
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    synchronize();
  });
  resizeObserver?.observe(container);
  intersection?.observe(container);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', synchronize);
  motionQuery?.addEventListener('change', onMotionChange);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  resize();
  return {
    refresh: resize,
    destroy() {
      if (disposed) return;
      disposed = true; stop();
      resizeObserver?.disconnect(); intersection?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', synchronize);
      motionQuery?.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      release(); colorCache.clear();
      // Free owned resources without forcing loss of a canvas reused by StrictMode.
      container.dataset.gridScanState = 'fallback';
    },
  };
}
