"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function BrandSplash() {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const seen = sessionStorage.getItem("kravia-entry-seen");
    const timer = window.setTimeout(() => {
      if (!seen) sessionStorage.setItem("kravia-entry-seen", "true");
      setVisible(false);
    }, seen ? 0 : (reducedMotion ? 250 : 1300));
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);
  return <AnimatePresence>{visible && <motion.div className="brand-splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? .1 : .35 }}><motion.div initial={reducedMotion ? false : { opacity: 0, scale: .94, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: .65, ease: [0.22, 1, 0.36, 1] }}><BrandLogo inverse priority /><span className="brand-splash-line" /></motion.div></motion.div>}</AnimatePresence>;
}
