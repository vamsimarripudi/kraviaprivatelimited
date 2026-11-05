"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type MotionProps,
} from "motion/react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
} from "react";
import styles from "./rotating-text.module.css";

export type RotatingTextHandle = {
  next: () => void;
  previous: () => void;
  reset: () => void;
  jumpTo: (index: number) => void;
};

type RotatingTextProps = {
  texts: readonly string[];
  effect?: "slide" | "blur" | "scale" | "drop";
  direction?: "up" | "down";
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | "random" | number;
  splitBy?: "characters" | "words" | "lines" | string;
  loop?: boolean;
  auto?: boolean;
  pauseOnHover?: boolean;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  style?: CSSProperties;
  onNext?: (index: number) => void;
  onMouseEnter?: MouseEventHandler<HTMLSpanElement>;
  onMouseLeave?: MouseEventHandler<HTMLSpanElement>;
};

const EFFECTS = {
  slide: (up: boolean): MotionProps => ({
    initial: { y: up ? "100%" : "-100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: up ? "-120%" : "120%", opacity: 0 },
    transition: { type: "spring", damping: 25, stiffness: 300 },
  }),
  blur: (up: boolean): MotionProps => ({
    initial: { y: up ? "45%" : "-45%", opacity: 0, filter: "blur(10px)" },
    animate: { y: 0, opacity: 1, filter: "blur(0px)" },
    exit: { y: up ? "-45%" : "45%", opacity: 0, filter: "blur(10px)" },
    transition: { type: "tween", duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
  scale: (up: boolean): MotionProps => ({
    initial: { scale: up ? 0.35 : 1.7, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: up ? 1.7 : 0.35, opacity: 0 },
    transition: { type: "spring", damping: 17, stiffness: 240 },
  }),
  drop: (): MotionProps => ({
    initial: { y: "-110%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "110%", opacity: 0 },
    transition: { type: "spring", damping: 18, stiffness: 320, mass: 0.9 },
  }),
};

const splitText = (text: string, splitBy: RotatingTextProps["splitBy"]) => {
  if (splitBy === "words") return text.split(" ").map((part, index, all) => ({ characters: [part], needsSpace: index < all.length - 1 }));
  if (splitBy === "lines") return text.split("\n").map((part, index, all) => ({ characters: [part], needsSpace: index < all.length - 1 }));
  if (splitBy && splitBy !== "characters") return text.split(splitBy).map((part, index, all) => ({ characters: [part], needsSpace: index < all.length - 1 }));

  return text.split(" ").map((word, index, all) => ({ characters: Array.from(word), needsSpace: index < all.length - 1 }));
};

const RotatingText = forwardRef<RotatingTextHandle, RotatingTextProps>(function RotatingText(
  {
    texts,
    effect = "slide",
    direction = "up",
    rotationInterval = 2000,
    staggerDuration = 0,
    staggerFrom = "first",
    splitBy = "characters",
    loop = true,
    auto = true,
    pauseOnHover = false,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
    style,
    onNext,
    onMouseEnter,
    onMouseLeave,
  },
  ref,
) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const indexRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const motionAvailable = typeof window !== "undefined" && typeof window.addEventListener === "function";
  const activeIndex = Math.min(currentTextIndex, Math.max(texts.length - 1, 0));
  const elements = useMemo(() => splitText(texts[activeIndex] ?? "", splitBy), [activeIndex, splitBy, texts]);

  const goTo = useCallback((index: number) => {
    if (index === indexRef.current) return;
    indexRef.current = index;
    setCurrentTextIndex(index);
    onNext?.(index);
  }, [onNext]);

  const next = useCallback(() => {
    const lastIndex = Math.max(texts.length - 1, 0);
    const current = Math.min(indexRef.current, lastIndex);
    goTo(current < lastIndex ? current + 1 : loop ? 0 : current);
  }, [goTo, loop, texts.length]);

  const previous = useCallback(() => {
    const lastIndex = Math.max(texts.length - 1, 0);
    const current = Math.min(indexRef.current, lastIndex);
    goTo(current > 0 ? current - 1 : loop ? lastIndex : current);
  }, [goTo, loop, texts.length]);

  const jumpTo = useCallback((index: number) => {
    goTo(Math.max(0, Math.min(index, Math.max(texts.length - 1, 0))));
  }, [goTo, texts.length]);

  useImperativeHandle(ref, () => ({ next, previous, reset: () => goTo(0), jumpTo }), [goTo, jumpTo, next, previous]);

  useEffect(() => {
    if (!auto || (pauseOnHover && hovered) || reducedMotion || texts.length < 2) return;
    const timeoutId = window.setTimeout(next, rotationInterval);
    return () => window.clearTimeout(timeoutId);
  }, [auto, hovered, next, pauseOnHover, reducedMotion, rotationInterval, texts.length, activeIndex]);

  useEffect(() => {
    if (!motionAvailable) return;
    const frame = window.requestAnimationFrame(() => setMotionReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [motionAvailable]);

  const preset = (EFFECTS[effect] ?? EFFECTS.slide)(direction !== "down");
  const getDelay = (index: number) => {
    const total = elements.reduce((sum, item) => sum + item.characters.length, 0);
    if (staggerFrom === "last") return (total - 1 - index) * staggerDuration;
    if (staggerFrom === "center") return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
    if (staggerFrom === "random") return ((index * 17) % Math.max(total, 1)) * staggerDuration;
    if (typeof staggerFrom === "number") return Math.abs(staggerFrom - index) * staggerDuration;
    return index * staggerDuration;
  };

  const handleMouseEnter: MouseEventHandler<HTMLSpanElement> = (event) => {
    if (pauseOnHover) setHovered(true);
    onMouseEnter?.(event);
  };

  const handleMouseLeave: MouseEventHandler<HTMLSpanElement> = (event) => {
    setHovered(false);
    onMouseLeave?.(event);
  };

  const plainText = elements.map((word, wordIndex) => (
    <span key={`plain-${activeIndex}-${wordIndex}`} className={styles.word}>
      {word.characters.join("")}
      {word.needsSpace ? <span className={styles.space}> </span> : null}
    </span>
  ));

  if (!motionReady) {
    return (
      <span className={[styles.root, mainClassName].filter(Boolean).join(" ")} style={style} role="status" aria-live="polite" aria-atomic="true">
        <span className={styles.screenReaderOnly}>{texts[activeIndex] ?? ""}</span>
        <span className={styles.text} aria-hidden="true">{plainText}</span>
      </span>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        className={[styles.root, mainClassName].filter(Boolean).join(" ")}
        style={style}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className={styles.screenReaderOnly}>{texts[activeIndex] ?? ""}</span>
        <AnimatePresence initial={false} mode="wait">
          <motion.span key={activeIndex} className={styles.text} aria-hidden="true" initial={preset.initial} animate={preset.animate} exit={preset.exit} transition={preset.transition}>
            {elements.map((word, wordIndex) => {
              const offset = elements.slice(0, wordIndex).reduce((sum, item) => sum + item.characters.length, 0);
              return (
                <span key={`${activeIndex}-${wordIndex}`} className={[styles.word, splitLevelClassName].filter(Boolean).join(" ")}>
                  {word.characters.map((character, characterIndex) => (
                    <motion.span
                      key={`${activeIndex}-${wordIndex}-${characterIndex}`}
                      className={[styles.element, elementLevelClassName].filter(Boolean).join(" ")}
                      initial={preset.initial}
                      animate={preset.animate}
                      transition={{ ...preset.transition, delay: getDelay(offset + characterIndex) }}
                    >
                      {character}
                    </motion.span>
                  ))}
                  {word.needsSpace ? <span className={styles.space}> </span> : null}
                </span>
              );
            })}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </MotionConfig>
  );
});

RotatingText.displayName = "RotatingText";

export default RotatingText;
