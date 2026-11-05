"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import styles from "./homepage-reveal.module.css";

export interface HomepageRevealProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "li";
  /** Stagger in milliseconds, bounded to 240 ms. */
  delay?: number;
}

/** Progressive enhancement: SSR and teardown always leave readable content. */
export function initializeHomepageReveal(element: HTMLElement) {
  let disposed = false;
  let complete = element.dataset.revealComplete === "true";
  let frame = 0;
  let observer: IntersectionObserver | null = null;
  const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  const reveal = (immediately = false) => {
    if (disposed) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (immediately) element.dataset.revealReady = "false";
    complete = true;
    element.dataset.revealComplete = "true";
    element.dataset.revealed = "true";
    observer?.disconnect();
  };
  const onFocus = () => reveal(true);
  const onMotionChange = () => {
    element.dataset.revealMotion = preference?.matches ? "reduced" : "full";
    if (preference?.matches) reveal(true);
  };
  const reduced = preference?.matches ?? true;
  element.dataset.revealMotion = reduced ? "reduced" : "full";
  element.dataset.revealReady = "false";

  // Content already within/past the viewport stays visible. Only below-the-fold
  // content can be armed, avoiding a flash or an invisible first-screen section.
  const belowViewport = element.getBoundingClientRect().top >= window.innerHeight;
  if (complete || reduced || !belowViewport || element.matches(":focus-within") || typeof IntersectionObserver === "undefined") {
    reveal(true);
  } else {
    element.dataset.revealed = "false";
    observer = new IntersectionObserver((entries) => {
      if (!disposed && entries.some((entry) => entry.isIntersecting)) reveal();
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    observer.observe(element);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed && !complete) element.dataset.revealReady = "true";
    });
  }

  element.addEventListener("focusin", onFocus);
  preference?.addEventListener("change", onMotionChange);
  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    element.removeEventListener("focusin", onFocus);
    preference?.removeEventListener("change", onMotionChange);
    element.dataset.revealReady = "false";
    element.dataset.revealed = "true";
  };
}

export function HomepageReveal({ as = "div", children, className = "", delay = 0, style, ...rest }: HomepageRevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const attach = useCallback((element: HTMLElement | null) => { elementRef.current = element; }, []);
  const safeDelay = Number.isFinite(delay) ? Math.min(240, Math.max(0, delay)) : 0;
  useEffect(() => {
    if (elementRef.current) return initializeHomepageReveal(elementRef.current);
  }, []);

  const Tag = as;
  return <Tag
    {...rest}
    ref={attach}
    className={`${styles.reveal} ${className}`.trim()}
    style={{ ...style, "--homepage-reveal-delay": `${safeDelay}ms` } as CSSProperties}
    data-revealed="true"
  >{children}</Tag>;
}
