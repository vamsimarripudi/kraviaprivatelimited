"use client";

import Image from "next/image";
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
    }, seen ? 0 : (reducedMotion ? 250 : 1650));
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  return <AnimatePresence>{visible && (
    <motion.div className="brand-splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? .1 : .35 }}>
      <div className="brand-splash-grid" aria-hidden="true" />
      <motion.div className="brand-splash-content" initial={reducedMotion ? false : { opacity: 0, y: 10, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: .65, ease: [0.22, 1, 0.36, 1] }}>
        {reducedMotion ? <BrandLogo inverse priority /> : <><Image className="brand-splash-mark" src="/brand/kravia-enterprise-v2.svg" alt="Kravia" width={260} height={260} priority unoptimized /><div className="brand-splash-copy"><strong>KRAVIA</strong><span>PRIVATE LIMITED</span></div></>}
        <span className="brand-splash-line" aria-hidden="true" />
      </motion.div>
    </motion.div>
  )}</AnimatePresence>;
}