"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const preferenceKey = "kravia.office.appearance";

/** Keep Office, Finance, sign-in and pending-activation visuals in sync. */
export function OfficeAppearanceRoot({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

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

  return <div className="kravia-office" data-office-theme={theme}>{children}</div>;
}
