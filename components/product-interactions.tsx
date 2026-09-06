"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { useEffect, type ReactNode } from "react";

export type ProductAnalyticsEvent =
  | "yukta_product_view"
  | "yukta_explore_clicked"
  | "yukta_contact_clicked"
  | "yukta_early_access_clicked"
  | "vidyaluma_card_viewed"
  | "vidyaluma_product_view"
  | "vidyaluma_cta_clicked"
  | "vidyaluma_enquiry_started"
  | "vorio_card_viewed"
  | "vorio_product_view"
  | "vorio_cta_clicked"
  | "vorio_explore_clicked"
  | "vorio_contact_clicked"
  | "vorio_early_access_clicked";

export function ProductAnalytics({ event, product }: { event: ProductAnalyticsEvent; product: string }) {
  useEffect(() => {
    track(event, { product });
  }, [event, product]);

  return null;
}

export function ProductTrackedLink({ event, product, href, className, children, ariaLabel, external = false }: {
  event: ProductAnalyticsEvent;
  product: string;
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  external?: boolean;
}) {
  const onClick = () => track(event, { product });
  if (external) return <a href={href} className={className} aria-label={ariaLabel} onClick={onClick}>{children}</a>;
  return <Link href={href} className={className} aria-label={ariaLabel} onClick={onClick}>{children}</Link>;
}