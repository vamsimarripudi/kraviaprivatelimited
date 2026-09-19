"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function OfficePrefetchRoutes({ hrefs }: { hrefs: readonly string[] }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(hrefs)).slice(0, 20);
    const warm = () => {
      if (cancelled) return;
      unique.forEach((href, index) => {
        window.setTimeout(() => {
          if (!cancelled) router.prefetch(href);
        }, index * 35);
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
  }, [hrefs, router]);

  return null;
}
