"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function OfficePrefetchRoutes({ hrefs }: { hrefs: readonly string[] }) {
  const router = useRouter();

  // React recomputes the small client-side navigation list on each render.
  // Only prefetch when the actual set of permitted paths changes, not when
  // a new array instance carries the same paths.
  const hrefKey=Array.from(new Set(hrefs)).join("|");
  useEffect(() => {
    let cancelled = false;
    const unique = hrefKey.split("|").filter(Boolean).slice(0, 8);
    const warm = () => {
      if (cancelled) return;
      unique.forEach((href, index) => {
        window.setTimeout(() => {
          if (!cancelled) router.prefetch(href);
        }, index * 120);
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(warm, { timeout: 900 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }

    const id = window.setTimeout(warm, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [hrefKey, router]);

  return null;
}
