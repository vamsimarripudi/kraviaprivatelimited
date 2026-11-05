"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";

interface ScrollVelocityProps {
  children: ReactNode;
  className?: string;
  maxSkew?: number;
  maxShift?: number;
}

const subscribeToHydration = () => () => {};
const getClientHydration = () => true;
const getServerHydration = () => false;

/**
 * Gives a decorative surface a small amount of momentum while the page moves.
 * The effect is intentionally bounded and is disabled for reduced-motion users.
 */
export function ScrollVelocitySurface({
  children,
  className,
  maxSkew = 0.8,
  maxShift = 8,
}: ScrollVelocityProps) {
  const prefersReducedMotion = useReducedMotion();

  // Keep the server and first client render free of document-level motion listeners.
  // The velocity hooks mount only after hydration, avoiding SSR/browser API drift.
  const mounted = useSyncExternalStore(subscribeToHydration, getClientHydration, getServerHydration);

  if (!mounted || prefersReducedMotion) {
    return (
      <div
        className={className}
        aria-hidden="true"
        data-scroll-velocity={prefersReducedMotion ? "disabled" : "enabled"}
      >
        {children}
      </div>
    );
  }

  return (
    <VelocityMotionSurface className={className} maxSkew={maxSkew} maxShift={maxShift}>
      {children}
    </VelocityMotionSurface>
  );
}

function VelocityMotionSurface({
  children,
  className,
  maxSkew,
  maxShift,
}: Required<Pick<ScrollVelocityProps, "children" | "maxSkew" | "maxShift">> & Pick<ScrollVelocityProps, "className">) {
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothedVelocity = useSpring(scrollVelocity, {
    damping: 34,
    mass: 0.45,
    stiffness: 180,
  });
  const skewY = useTransform(smoothedVelocity, [-2200, 0, 2200], [maxSkew, 0, -maxSkew]);
  const shiftY = useTransform(smoothedVelocity, [-2200, 0, 2200], [maxShift, 0, -maxShift]);

  return (
    <motion.div
      className={className}
      aria-hidden="true"
      data-scroll-velocity="enabled"
      style={{ skewY, y: shiftY }}
    >
      {children}
    </motion.div>
  );
}
