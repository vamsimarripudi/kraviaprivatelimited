'use client';

// GridScan visual adapted from the complete user-supplied Pasted text.txt.
// Shader provenance and source checksum are recorded in grid-scan-scene.ts.
import { useEffect, useMemo, useRef, type HTMLAttributes } from 'react';
import { createGridScanScene, type GridScanSettings } from '../lib/visuals/grid-scan-scene';
import './grid-scan.css';

export interface GridScanProps extends HTMLAttributes<HTMLDivElement> {
  linesColor?: string;
  scanColor?: string;
  cells?: number;
  lineThickness?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  depth?: number;
  depthFade?: number;
  parallax?: number;
  points?: boolean;
  reflection?: number;
  shading?: number;
  scanDirection?: 'forward' | 'backward' | 'pingpong';
  scanDuration?: number;
  scanDelay?: number;
  scanWidth?: number;
  trail?: number;
  glow?: number;
  autoScan?: boolean;
  intro?: boolean;
  lightMode?: boolean;
  paused?: boolean;
  dpr?: number;
}
const styles = { solid: 0, dashed: 1, dotted: 2 } as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function GridScan({
  linesColor, scanColor, cells = 8, lineThickness = 1, lineStyle = 'solid', depth = 3,
  depthFade = 0.6, parallax = 0.4, points = true, reflection = 0.25, shading = 0.7,
  scanDirection = 'forward', scanDuration = 3.2, scanDelay = 1.8, scanWidth = 1,
  trail = 0.5, glow = 0.4, autoScan = true, intro = false, lightMode = false,
  paused = false, dpr = 1.25, className = '', ...rest
}: GridScanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReturnType<typeof createGridScanScene>>(null);
  const settings = useMemo<GridScanSettings>(() => ({
    linesColor: linesColor ?? (lightMode ? '#d4d4d8' : '#4d4757'),
    scanColor: scanColor ?? (lightMode ? '#0284c7' : '#7dd3fc'),
    cells: clamp(cells, 2, 40), thickness: clamp(lineThickness, 0.5, 4), style: styles[lineStyle],
    depth: clamp(depth, 0.5, 12), depthFade: clamp(depthFade, 0, 1), parallax: clamp(parallax, 0, 3),
    points, reflection: clamp(reflection, 0, 1), shading: clamp(shading, 0, 1), direction: scanDirection,
    duration: clamp(scanDuration, 0.3, 20), delay: clamp(scanDelay, 0, 30), scanWidth: clamp(scanWidth, 0.2, 5),
    trail: clamp(trail, 0, 1), glow: clamp(glow, 0, 1.5), autoScan, intro, lightMode, paused, dpr,
  }), [linesColor, scanColor, cells, lineThickness, lineStyle, depth, depthFade, parallax, points,
    reflection, shading, scanDirection, scanDuration, scanDelay, scanWidth, trail, glow, autoScan, intro, lightMode, paused, dpr]);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    engineRef.current?.refresh();
  }, [settings]);
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const engine = createGridScanScene(container, canvas, () => settingsRef.current);
    engineRef.current = engine;
    return () => { engine?.destroy(); engineRef.current = null; };
  }, []);

  return <div ref={containerRef} className={`grid-scan ${className}`.trim()} {...rest} aria-hidden="true">
    <canvas ref={canvasRef} className="grid-scan-canvas" aria-hidden="true" />
  </div>;
}

export default GridScan;
