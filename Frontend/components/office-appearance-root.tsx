"use client";

import { useEffect, useState } from "react";
import {readMotionMode} from "@/lib/office/connect-preferences";

type Theme = "light" | "dark";
const preferenceKey = "kravia.office.appearance";

/** Keep Office, Finance, sign-in and pending-activation visuals in sync. */
export function OfficeAppearanceRoot({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(preferenceKey);
        setTheme(stored === "light" || stored === "dark" ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      } catch { setTheme("light"); }
    });
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === "light" || next === "dark") setTheme(next);
    };
    window.addEventListener("kravia-office-theme-change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("kravia-office-theme-change", onChange);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const mode=readMotionMode();
      setReduceMotion(mode==="reduced"||(mode==="system"&&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    };
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("kravia-office-motion-change",update);
    media.addEventListener("change",update);
    // Avoid assigning a preference during render/hydration.
    const frame=window.requestAnimationFrame(update);
    return()=>{window.cancelAnimationFrame(frame);media.removeEventListener("change",update);
      window.removeEventListener("kravia-office-motion-change",update);};
  },[]);
  return <div className="kravia-office" data-office-theme={theme}
    data-office-reduced-motion={reduceMotion}>{children}</div>;
}
