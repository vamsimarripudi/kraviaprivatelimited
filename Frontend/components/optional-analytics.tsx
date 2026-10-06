"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { privacyCookieFromDocument } from "@/lib/privacy/choices";

type PrivacyChoiceEvent = CustomEvent<{ optionalAnalytics: boolean }>;

function globalPrivacyControlActive() {
  return Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
}

function optionalAnalyticsAllowed() {
  return !globalPrivacyControlActive() && privacyCookieFromDocument(document.cookie)?.optionalAnalytics === true;
}

/**
 * Loads Vercel Analytics only after an affirmative, persisted optional choice.
 * A later withdrawal reloads the page from the preference control so an
 * already-injected third-party script cannot remain active in that session.
 */
export function OptionalAnalytics() {
  const [enabled, setEnabled] = useState(false);
  const [AnalyticsComponent, setAnalyticsComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    const updateFromBrowser = () => setEnabled(optionalAnalyticsAllowed());
    const updateFromPreference = (event: Event) => {
      const detail = (event as PrivacyChoiceEvent).detail;
      setEnabled(Boolean(detail?.optionalAnalytics) && !globalPrivacyControlActive());
    };
    updateFromBrowser();
    window.addEventListener("kravia:privacy-choices", updateFromPreference);
    return () => window.removeEventListener("kravia:privacy-choices", updateFromPreference);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAnalyticsComponent(null);
      return;
    }
    let active = true;
    void import("@vercel/analytics/next").then(({ Analytics }) => {
      if (active) setAnalyticsComponent(() => Analytics);
    });
    return () => { active = false; };
  }, [enabled]);

  return enabled && AnalyticsComponent ? <AnalyticsComponent /> : null;
}
