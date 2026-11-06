"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./diwali-celebration.css";

type Brand = "kravia" | "vidyaluma";
type Rocket = { x: number; y: number; targetX: number; targetY: number; hue: number; speed: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; hue: number };

const START = Date.parse("2026-11-07T18:30:00.000Z");
const END = Date.parse("2026-11-08T18:30:00.000Z");
const ALLOWED_VIDYALUMA = new Set(["/", "/about", "/product", "/solutions", "/pricing", "/resources", "/marketing-preview"]);
const ALLOWED_KRAVIA = new Set(["/", "/products", "/company"]);

function publicPath(brand: Brand) {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return brand === "vidyaluma"
    ? ALLOWED_VIDYALUMA.has(path)
    : ALLOWED_KRAVIA.has(path) || path.startsWith("/products/");
}

function alreadyGreeted(brand: Brand) {
  try { return sessionStorage.getItem("diwali-2026-" + brand) === "seen"; }
  catch { return false; }
}

function rememberGreeting(brand: Brand) {
  try { sessionStorage.setItem("diwali-2026-" + brand, "seen"); }
  catch { /* Private browsing may disable session storage. */ }
}

export function DiwaliCelebration({ brand }: { brand: Brand }) {
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const launchRef = useRef<(x?: number, y?: number) => void>(() => {});
  const audioRef = useRef<AudioContext | null>(null);

  const dismiss = useCallback(() => {
    rememberGreeting(brand);
    setOpen(false);
    setInteracting(false);
  }, [brand]);

  useEffect(() => {
    let started = false;
    const refresh = () => {
      const now = Date.now();
      const eligible = now >= START && now < END && publicPath(brand);
      setActive(eligible);
      if (!eligible) {
        setOpen(false);
        return;
      }
      if (!started) {
        started = true;
        const path = window.location.pathname.replace(/\/+$/, "") || "/";
        if (path === "/" && !alreadyGreeted(brand)) setOpen(true);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [brand]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => () => { void audioRef.current?.close(); }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusTask = window.setTimeout(() => primaryButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
      if (event.key !== "Tab") return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTask);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, dismiss]);

  // The intro collapses after 11 seconds; interacting keeps the celebration open.
  useEffect(() => {
    if (!open || interacting) return;
    const timeout = window.setTimeout(dismiss, 11000);
    return () => window.clearTimeout(timeout);
  }, [open, interacting, dismiss]);

  useEffect(() => {
    if (!open || reducedMotion) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let width = 1;
    let height = 1;
    let animationId = 0;
    let tick = 0;
    let rockets: Rocket[] = [];
    let sparks: Spark[] = [];
    const timerIds: number[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const burst = (rocket: Rocket) => {
      const count = width < 600 ? 35 : 54;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.09;
        const velocity = 1.2 + Math.random() * 3.4;
        sparks.push({
          x: rocket.x, y: rocket.y,
          vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
          life: 42 + Math.random() * 22,
          maxLife: 64,
          hue: (rocket.hue + Math.random() * 42) % 360,
        });
      }
      if (sparks.length > 360) sparks = sparks.slice(-360);
    };

    const launch = (x?: number, y?: number) => {
      if (rockets.length >= 5) return;
      rockets.push({
        x: Math.random() * width,
        y: height + 12,
        targetX: Math.max(20, Math.min(width - 20, x ?? width * (0.15 + Math.random() * 0.7))),
        targetY: Math.max(50, Math.min(height * 0.65, y ?? height * (0.12 + Math.random() * 0.35))),
        hue: [34, 48, 160, 198, 286, 330][Math.floor(Math.random() * 6)],
        speed: 9 + Math.random() * 3,
      });
    };
    launchRef.current = launch;
    resize();
    timerIds.push(window.setTimeout(() => launch(width * 0.25), 450));
    timerIds.push(window.setTimeout(() => launch(width * 0.72), 1300));

    const render = () => {
      animationId = window.requestAnimationFrame(render);
      if (document.visibilityState === "hidden") return;
      context.clearRect(0, 0, width, height);
      tick++;
      if (tick % 94 === 0) launch();

      rockets = rockets.filter((rocket) => {
        const dx = rocket.targetX - rocket.x;
        const dy = rocket.targetY - rocket.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= rocket.speed) {
          burst(rocket);
          return false;
        }
        const oldX = rocket.x;
        const oldY = rocket.y;
        rocket.x += (dx / distance) * rocket.speed;
        rocket.y += (dy / distance) * rocket.speed;
        context.beginPath();
        context.moveTo(oldX, oldY + 16);
        context.lineTo(rocket.x, rocket.y);
        context.lineWidth = 2.4;
        context.strokeStyle = "hsla(" + rocket.hue + ", 100%, 78%, .95)";
        context.stroke();
        return true;
      });

      sparks = sparks.filter((spark) => {
        spark.life--;
        if (spark.life <= 0) return false;
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.036;
        context.globalAlpha = Math.max(0, spark.life / spark.maxLife);
        context.fillStyle = "hsl(" + spark.hue + ", 100%, 72%)";
        context.beginPath();
        context.arc(spark.x, spark.y, width < 600 ? 1.3 : 1.9, 0, Math.PI * 2);
        context.fill();
        return true;
      });
      context.globalAlpha = 1;
    };
    animationId = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      timerIds.forEach(window.clearTimeout);
      launchRef.current = () => {};
    };
  }, [open, reducedMotion]);

  function softFireworkSound() {
    if (!soundEnabled || typeof window.AudioContext === "undefined") return;
    try {
      const audio = audioRef.current ?? new window.AudioContext();
      audioRef.current = audio;
      void audio.resume();
      const oscillator = audio.createOscillator();
      const volume = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(210, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, audio.currentTime + 0.22);
      volume.gain.setValueAtTime(0.0001, audio.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.045, audio.currentTime + 0.035);
      volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.24);
      oscillator.connect(volume);
      volume.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.25);
    } catch { /* Sound is optional; the visual greeting must continue. */ }
  }

  function launchAt(x?: number, y?: number) {
    setInteracting(true);
    launchRef.current(x, y);
    softFireworkSound();
  }

  if (!active) return null;
  const isKravia = brand === "kravia";
  return <>
    {open ? <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diwali-2026-title"
      aria-describedby="diwali-2026-description"
      className={"diwali-festival diwali-festival--" + brand}
    >
      <canvas
        ref={canvasRef}
        className="diwali-festival__sky"
        aria-label="Tap the night sky to launch digital fireworks"
        onPointerDown={(event) => {
          if (reducedMotion) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          launchAt(event.clientX - bounds.left, event.clientY - bounds.top);
        }}
      />
      <div className="diwali-festival__glow" aria-hidden="true" />
      <div className="diwali-festival__decor diwali-festival__decor--left" aria-hidden="true">🪔</div>
      <div className="diwali-festival__decor diwali-festival__decor--right" aria-hidden="true">🪔</div>
      <div className="diwali-festival__content">
        <div className="diwali-festival__brand">
          <img
            src={isKravia ? "/brand/kravia-enterprise-v2.svg" : "/brand/v2/vidyaluma-horizontal-inverse.svg"}
            alt={isKravia ? "KRAVIA PRIVATE LIMITED" : "VidyaLuma"}
          />
        </div>
        <p className="diwali-festival__eyebrow">A celebration of light and new beginnings</p>
        <div className="diwali-festival__diya" aria-hidden="true">🪔</div>
        <h1 id="diwali-2026-title">Happy Diwali <span>2026</span></h1>
        <p className="diwali-festival__telugu" lang="te">దీపావళి శుభాకాంక్షలు!</p>
        <p id="diwali-2026-description" className="diwali-festival__message">
          {isKravia
            ? "Wishing you and your loved ones a season of light, peace, prosperity and new possibilities."
            : "May the light of learning, curiosity and new possibilities shine brighter for every learner."}
        </p>
        <div className="diwali-festival__actions">
          <button
            ref={primaryButtonRef}
            className="diwali-festival__launch"
            type="button"
            onClick={() => launchAt()}
            disabled={reducedMotion}
          >{reducedMotion ? "Fireworks paused" : "✨ Launch fireworks"}</button>
          <button className="diwali-festival__enter" type="button" onClick={dismiss}>Enter website</button>
          <button className="diwali-festival__sound" type="button" aria-pressed={soundEnabled} onClick={() => { setSoundEnabled((value) => !value); setInteracting(true); }}>
            {soundEnabled ? "🔊 Sound on" : "🔇 Sound off"}
          </button>
        </div>
        <p className="diwali-festival__hint">{reducedMotion ? "Reduced-motion setting respected." : "Tap anywhere in the night sky for more fireworks · Esc to close"}</p>
      </div>
    </div> : <button
      className={"diwali-festival__reopen diwali-festival__reopen--" + brand}
      type="button"
      onClick={() => { setInteracting(false); setOpen(true); }}
      aria-label="Open the Diwali 2026 celebration"
    >🪔 <span>Celebrate Diwali</span></button>}
  </>;
}
