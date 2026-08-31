"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { useEffect, type ReactNode } from "react";

type YuktaEvent = "yukta_explore_clicked" | "yukta_contact_clicked" | "yukta_early_access_clicked";

export function YuktaAnalytics() {
  useEffect(() => {
    track("yukta_product_view", { product: "yukta" });
  }, []);

  return null;
}

export function YuktaTrackedLink({ event, href, className, children, ariaLabel }: {
  event: YuktaEvent;
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return <Link href={href} className={className} aria-label={ariaLabel} onClick={() => track(event, { product: "yukta" })}>{children}</Link>;
}