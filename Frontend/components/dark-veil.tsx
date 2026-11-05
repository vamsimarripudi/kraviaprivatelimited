'use client';

// React Bits DarkVeil by David Haz, adapted for the KRAVIA hero.
// Original shader and props: https://reactbits.dev/r/DarkVeil-TS-CSS.json
// License: ../third-party/react-bits-LICENSE.md (MIT + Commons Clause).
import { useEffect, useMemo, useRef, type HTMLAttributes } from 'react';
import { createDarkVeilScene, type DarkVeilSettings } from '../lib/visuals/dark-veil-scene';
import './dark-veil.css';

export interface DarkVeilProps extends HTMLAttributes<HTMLDivElement> {
  color?: string;
  speed?: number;
  scale?: number;
  rotation?: number;
  flow?: number;
  warp?: number;
  variation?: number;
  brightness?: number;
  sheen?: number;
  glow?: number;
  grain?: number;
  quality?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  intro?: boolean;
  fade?: number;
  opacity?: number;
  lightMode?: boolean;
  paused?: boolean;
  dpr?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DarkVeil({
  color = '#72b7ce', speed = 0.24, scale = 1, rotation = 0, flow = 1, warp = 0,
  variation = 0, brightness = 1, sheen = 0, glow = 0.4, grain = 0.015, quality = 0.5,
  mouseInteraction = false, mouseStrength = 1, intro = false, fade = 0, opacity = 1,
  lightMode = false, paused = false, dpr = 1.25, className = '', ...rest
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReturnType<typeof createDarkVeilScene>>(null);
  const settings = useMemo<DarkVeilSettings>(() => ({
    color: String(color), speed, scale: Math.max(0.1, scale), rotation,
    flow: Math.max(0, flow), warp: Math.max(0, warp), variation,
    brightness: Math.max(0, brightness), sheen: Math.max(0, sheen), glow: Math.max(0, glow),
    grain: Math.max(0, grain), quality: clamp(quality, 0.25, 1), mouseInteraction,
    mouseStrength: Math.max(0, mouseStrength), intro, fade: clamp(fade, 0, 1),
    opacity: clamp(opacity, 0, 1), lightMode, paused, dpr,
  }), [color, speed, scale, rotation, flow, warp, variation, brightness, sheen, glow, grain,
    quality, mouseInteraction, mouseStrength, intro, fade, opacity, lightMode, paused, dpr]);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
    engineRef.current?.refresh();
  }, [settings]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const engine = createDarkVeilScene(container, canvas, () => settingsRef.current);
    engineRef.current = engine;
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={`dark-veil-container ${className}`.trim()} {...rest} aria-hidden="true">
    <canvas ref={canvasRef} className="dark-veil-canvas" aria-hidden="true" />
  </div>;
}

export default DarkVeil;
