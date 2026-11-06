"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./diwali-celebration.module.css";
import { DIWALI_END_UTC, DIWALI_START_UTC, isDiwaliActive } from "./diwali-window";

type Brand = "kravia" | "vidyaluma";
type Rocket = { x: number; y: number; vx: number; vy: number; targetY: number; hue: number };
type Ember = { x: number; y: number; vx: number; vy: number; life: number; total: number; radius: number; hue: number };
type Fountain = { x: number; y: number; life: number };
type Wheel = { x: number; y: number; life: number; angle: number };

const SESSION_KEY = "diwali-2026-celebration-dismissed";
const brands = {
  kravia: {
    name: "KRAVIA PRIVATE LIMITED",
    logo: "/brand/kravia-enterprise-v2.svg",
    width: 260,
    height: 260,
    message: "May the festival of lights illuminate new ideas, meaningful work and brighter possibilities.",
    signature: "Warm wishes from KRAVIA PRIVATE LIMITED",
  },
  vidyaluma: {
    name: "VidyaLuma",
    logo: "/brand/v2/vidyaluma-horizontal-inverse.svg",
    width: 800,
    height: 190,
    message: "May every spark of curiosity become a brighter tomorrow. Wishing students, teachers and families a joyful Diwali.",
    signature: "Warm wishes from VidyaLuma",
  },
} as const;

function sessionDismissed() {
  try { return window.sessionStorage.getItem(SESSION_KEY) === "yes"; }
  catch { return false; }
}

function rememberDismissal() {
  try { window.sessionStorage.setItem(SESSION_KEY, "yes"); }
  catch { /* The celebration still closes when storage is unavailable. */ }
}

/**
 * One-day public website experience. UTC timestamps are the exact IST bounds:
 * 08 Nov 2026 00:00:00 through 09 Nov 2026 00:00:00 (exclusive).
 * No cron, backend call, deployment rollback, or site-wide CSS is required.
 */
export function DiwaliCelebration({ brand }: { brand: Brand }) {
  const config = brands[brand];
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(() => typeof window === "undefined" ? true : !sessionDismissed());
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const launchRef = useRef<((x?: number, y?: number) => void) | null>(null);
  const fountainRef = useRef<(() => void) | null>(null);
  const wheelRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const sync = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const now = Date.now();
      setActive(isDiwaliActive(now));
      const next = now < DIWALI_START_UTC ? DIWALI_START_UTC : now < DIWALI_END_UTC ? DIWALI_END_UTC : null;
      if (next !== null) timer = window.setTimeout(sync, Math.max(1, next - now + 25));
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dismissRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rememberDismissal();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => () => { if (audioRef.current) void audioRef.current.close(); }, []);

  // Use a bounded, device-aware canvas instead of heavy videos or autoplay media.
  useEffect(() => {
    if (!active || !open || paused || reducedMotion) {
      launchRef.current = null;
      fountainRef.current = null;
      wheelRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastFrame = 0;
    let nextAutomaticLaunch = 0;
    const rockets: Rocket[] = [];
    const embers: Ember[] = [];
    const fountains: Fountain[] = [];
    const wheels: Wheel[] = [];
    const palette = [28, 44, 176, 196, 266, 319, 346];

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // SVG ornamentation stays crisp in 4K; limit animated raster pixels.
      const budget = width >= 2200 ? 5_400_000 : 2_700_000;
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(budget / Math.max(1, width * height)));
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const burst = (x: number, y: number, hue: number) => {
      const count = width < 700 ? 30 : 60;
      const phase = Math.random() * Math.PI * 2;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + phase;
        const speed = 1.1 + Math.random() * (width < 700 ? 2.6 : 3.8);
        const life = 35 + Math.random() * 35;
        embers.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life, total: life,
          radius: 1.1 + Math.random() * 1.7,
          hue: (hue + (Math.random() - 0.5) * 28 + 360) % 360,
        });
      }
      if (embers.length > 420) embers.splice(0, embers.length - 420);
    };

    const launch = (x?: number, y?: number) => {
      if (width <= 0 || height <= 0 || rockets.length >= 7) return;
      const destinationX = Math.max(22, Math.min(width - 22, x ?? width * (0.18 + Math.random() * 0.64)));
      const destinationY = Math.max(36, Math.min(height * 0.62, y ?? height * (0.13 + Math.random() * 0.39)));
      const startingX = Math.max(22, Math.min(width - 22, destinationX + (Math.random() - 0.5) * 135));
      const steps = 42 + Math.random() * 16;
      rockets.push({
        x: startingX,
        y: height + 8,
        vx: (destinationX - startingX) / steps,
        vy: (destinationY - height - 8) / steps,
        targetY: destinationY,
        hue: palette[Math.floor(Math.random() * palette.length)],
      });
    };

    const lightAnaar = () => {
      if (fountains.length < 3) fountains.push({ x: width * 0.5, y: height * 0.84, life: 80 });
    };
    const spinChakri = () => {
      if (wheels.length < 3) wheels.push({ x: width * 0.5, y: height * 0.78, life: 90, angle: 0 });
    };

    const render = (time: number) => {
      const minimumFrameMs = width < 700 || width >= 2600 ? 30 : 16;
      if (lastFrame && time - lastFrame < minimumFrameMs) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }
      const step = lastFrame ? Math.max(0.5, Math.min((time - lastFrame) / 16.67, 2)) : 1;
      lastFrame = time;
      if (!document.hidden) {
        context.clearRect(0, 0, width, height);
        if (time >= nextAutomaticLaunch) {
          launch();
          nextAutomaticLaunch = time + (width < 700 ? 2300 : 1550);
        }
        for (let index = rockets.length - 1; index >= 0; index -= 1) {
          const rocket = rockets[index];
          rocket.x += rocket.vx * step;
          rocket.y += rocket.vy * step;
          context.beginPath();
          context.strokeStyle = "hsla(" + rocket.hue + ",100%,75%,0.95)";
          context.lineWidth = 2;
          context.moveTo(rocket.x, rocket.y + 12);
          context.lineTo(rocket.x, rocket.y);
          context.stroke();
          if (rocket.y <= rocket.targetY) {
            burst(rocket.x, rocket.y, rocket.hue);
            rockets.splice(index, 1);
          }
        }
        for (let index = fountains.length - 1; index >= 0; index -= 1) {
          const fountain = fountains[index];
          fountain.life -= step;
          if (fountain.life <= 0) { fountains.splice(index, 1); continue; }
          for (let spark = 0; spark < 3; spark += 1) {
            const life = 23 + Math.random() * 16;
            embers.push({
              x: fountain.x, y: fountain.y,
              vx: (Math.random() - 0.5) * 4.4, vy: -3.6 - Math.random() * 5,
              life, total: life, radius: 1.2 + Math.random() * 0.9,
              hue: 25 + Math.random() * 32
            });
          }
        }
        for (let index = wheels.length - 1; index >= 0; index -= 1) {
          const wheel = wheels[index];
          wheel.life -= step;
          wheel.angle += 0.28 * step;
          if (wheel.life <= 0) { wheels.splice(index, 1); continue; }
          for (let arm = 0; arm < 3; arm += 1) {
            const angle = wheel.angle + (arm * Math.PI * 2) / 3;
            const radius = 14 + (90 - wheel.life) * 0.13;
            const life = 20;
            embers.push({
              x: wheel.x + Math.cos(angle) * radius,
              y: wheel.y + Math.sin(angle) * radius,
              vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2,
              life, total: life, radius: 1.6,
              hue: [41, 188, 312][arm]
            });
          }
        }
        if (embers.length > 420) embers.splice(0, embers.length - 420);
        for (let index = embers.length - 1; index >= 0; index -= 1) {
          const ember = embers[index];
          ember.x += ember.vx * step;
          ember.y += ember.vy * step;
          ember.vx *= Math.pow(0.989, step);
          ember.vy += 0.023 * step;
          ember.life -= step;
          if (ember.life <= 0) {
            embers.splice(index, 1);
            continue;
          }
          const opacity = Math.max(0, ember.life / ember.total);
          context.fillStyle = "hsla(" + ember.hue + ",100%,75%," + opacity.toFixed(3) + ")";
          context.beginPath();
          context.arc(ember.x, ember.y, ember.radius * Math.max(0.35, opacity), 0, Math.PI * 2);
          context.fill();
        }
      }
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    launchRef.current = launch;
    fountainRef.current = lightAnaar;
    wheelRef.current = spinChakri;
    window.addEventListener("resize", resize, { passive: true });
    animationFrame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      launchRef.current = null;
      fountainRef.current = null;
      wheelRef.current = null;
    };
  }, [active, open, paused, reducedMotion]);

  const dismiss = () => {
    rememberDismissal();
    setOpen(false);
  };

  const playPop = () => {
    if (!soundOn) return;
    try {
      const audio = audioRef.current ?? new AudioContext();
      audioRef.current = audio;
      void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const when = audio.currentTime;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(190, when);
      oscillator.frequency.exponentialRampToValueAtTime(62, when + 0.22);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.055, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(when);
      oscillator.stop(when + 0.25);
    } catch { /* Muted experience remains fully functional. */ }
  };

  const triggerFirework = (x?: number, y?: number) => {
    if (paused) {
      setPaused(false);
    } else {
      launchRef.current?.(x, y);
      playPop();
    }
  };

  const triggerAnaar = () => {
    if (paused) setPaused(false);
    else { fountainRef.current?.(); playPop(); }
  };
  const triggerChakri = () => {
    if (paused) setPaused(false);
    else { wheelRef.current?.(); playPop(); }
  };

  const share = async () => {
    const greeting = "Happy Diwali 2026! దీపావళి శుభాకాంక్షలు!";
    const url = window.location.origin + "/";
    if (navigator.share) {
      try {
        await navigator.share({ title: greeting, text: config.signature, url });
        return;
      } catch { /* A cancelled share is not an error. */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Website link copied.");
    } catch {
      setShareStatus("Open this page to share the greeting.");
    }
  };

  if (!active) return null;

  return (
    <>
      {open ? (
        <div
          ref={dialogRef}
          className={[styles.overlay, brand === "kravia" ? styles.kravia : styles.vidyaluma].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-labelledby="diwali-2026-title"
          aria-describedby="diwali-2026-message"
        >
          <canvas
            ref={canvasRef}
            className={styles.fireworks}
            aria-hidden="true"
            onPointerDown={(event) => {
              if (reducedMotion || paused) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              triggerFirework(event.clientX - bounds.left, event.clientY - bounds.top);
            }}
          />
          <div className={styles.ambient} aria-hidden="true" />
          <div className={styles.ornaments} aria-hidden="true" />
          <div className={styles.frame}>
            <div className={styles.topbar}>
              <span className={styles.topLabel}>✦ &nbsp; FESTIVAL OF LIGHTS · 8 NOVEMBER 2026</span>
              <button type="button" ref={dismissRef} className={styles.close} onClick={dismiss} aria-label="Close Diwali greeting">
                Close <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className={styles.centerpiece}>
              <span className={styles.eyebrow}>A SPECIAL CELEBRATION FROM</span>
              <div className={styles.brandMark}>
                <img src={config.logo} alt={config.name} width={config.width} height={config.height} />
              </div>
              <div className={styles.diya} aria-hidden="true">🪔</div>
              <p className={styles.intro}>Wishing you and your loved ones</p>
              <h2 className={styles.title} id="diwali-2026-title">Happy Diwali <span>2026</span></h2>
              <p className={styles.telugu} lang="te">దీపావళి శుభాకాంక్షలు!</p>
              <p className={styles.message} id="diwali-2026-message">{config.message}</p>
              <p className={styles.signature}>{config.signature}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={reducedMotion} onClick={() => triggerFirework()}>
                  <span aria-hidden="true">✦</span> Launch fireworks
                </button>
                <button type="button" className={styles.secondary} onClick={triggerAnaar} disabled={reducedMotion}>✦ Light Anaar</button>
                <button type="button" className={styles.secondary} onClick={triggerChakri} disabled={reducedMotion}>✳ Spin Chakri</button>
                <button type="button" className={styles.secondary} onClick={share}>Share greeting</button>
              </div>
              <p className={styles.shareStatus} role="status" aria-live="polite">{shareStatus}</p>
            </div>
            <div className={styles.bottomBar}>
              <span className={styles.hint}>✧ Tap the night sky · launch an Anaar · spin a Chakri</span>
              <div className={styles.utilities}>
                <button type="button" onClick={() => setSoundOn((value) => !value)} aria-pressed={soundOn}>
                  Sound {soundOn ? "on" : "off"}
                </button>
                <button
                  type="button"
                  disabled={reducedMotion}
                  onClick={() => setPaused((value) => !value)}
                  aria-pressed={paused}
                  title={reducedMotion ? "Your reduced-motion setting is respected" : undefined}
                >
                  {reducedMotion ? "Reduced motion" : paused ? "Resume effects" : "Pause effects"}
                </button>
                <button type="button" onClick={dismiss}>Explore website</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={[styles.launcher, brand === "kravia" ? styles.kravia : styles.vidyaluma].join(" ")}
          onClick={() => { setShareStatus(""); setOpen(true); }}
          aria-label="Reopen the Diwali celebration"
        >
          <span aria-hidden="true">🪔</span> Celebrate Diwali
        </button>
      )}
    </>
  );
}
