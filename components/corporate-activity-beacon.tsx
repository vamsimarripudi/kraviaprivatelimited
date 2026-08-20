"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Records only authenticated Corporate Office and Site Control navigation, once per route visit. */
export function CorporateActivityBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/corporate/") && pathname !== "/admin" && !pathname.startsWith("/admin/")) return;
    void fetch("/api/corporate/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "PAGE_VIEWED", path: pathname }), keepalive: true });
  }, [pathname]);
  return null;
}
