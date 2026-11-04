"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ShieldCheck } from "lucide-react";
import { privacyCookieFromDocument } from "@/lib/privacy/choices";
import styles from "./cookie-preferences.module.css";

type PreferenceState = "loading" | "ready" | "saving" | "saved" | "error";
type PreferenceView = "summary" | "manage";

function globalPrivacyControlActive() {
  return Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
}

/** Optional analytics only start after a server-persisted affirmative choice. */
export function CookiePreferences() {
  const [state, setState] = useState<PreferenceState>("loading");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PreferenceView>("summary");
  const [optionalAnalytics, setOptionalAnalytics] = useState(false);
  const [globalPrivacyControl, setGlobalPrivacyControl] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const gpc = globalPrivacyControlActive();
    const saved = privacyCookieFromDocument(document.cookie);
    setGlobalPrivacyControl(gpc);
    setOptionalAnalytics(saved?.optionalAnalytics === true && !gpc);
    setOpen(!saved);
    setState("ready");

    const openPreferences = () => {
      setView("manage");
      setOpen(true);
      setState("ready");
    };
    window.addEventListener("kravia:open-privacy-choices", openPreferences);
    return () => window.removeEventListener("kravia:open-privacy-choices", openPreferences);
  }, []);

  useEffect(() => {
    if (open && view === "manage") panelRef.current?.focus({ preventScroll: true });
  }, [open, view]);

  useEffect(() => {
    if (!open || view !== "summary" || !layerRef.current) return;
    const layer = layerRef.current;
    const measure = () => {
      const bounds = layer.getBoundingClientRect();
      const bottomGap = Math.max(0, window.innerHeight - bounds.bottom);
      document.documentElement.style.setProperty("--privacy-notice-height", `${Math.ceil(bounds.height + bottomGap + 8)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.documentElement.style.removeProperty("--privacy-notice-height");
    };
  }, [open, view]);

  useEffect(() => {
    if (state !== "saved") return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setView("summary");
      setState("ready");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function saveChoice(allowOptional: boolean) {
    const nextOptionalAnalytics = globalPrivacyControl ? false : allowOptional;
    const priorOptionalAnalytics = privacyCookieFromDocument(document.cookie)?.optionalAnalytics === true;
    setState("saving");
    try {
      const response = await fetch("/api/privacy/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionalAnalytics: nextOptionalAnalytics, globalPrivacyControl }),
      });
      if (!response.ok) throw new Error("Preference persistence failed.");
      setOptionalAnalytics(nextOptionalAnalytics);
      setState("saved");
      window.dispatchEvent(new CustomEvent("kravia:privacy-choices", { detail: { optionalAnalytics: nextOptionalAnalytics } }));
      if (priorOptionalAnalytics && !nextOptionalAnalytics) window.setTimeout(() => window.location.reload(), 50);
    } catch {
      setState("error");
      setOpen(true);
    }
  }

  if (state === "loading" || !open) return null;

  const saving = state === "saving";
  const saved = state === "saved";
  const summary = view === "summary";
  const analyticsAlreadyEnabled = privacyCookieFromDocument(document.cookie)?.optionalAnalytics === true && !globalPrivacyControl;
  const savedMessage = <div className={styles.saved} role="status"><Check aria-hidden="true" /><div><strong>Preferences saved</strong><span>{optionalAnalytics ? "Optional analytics are enabled." : "Optional analytics remain off."}</span></div></div>;
  return <aside ref={layerRef} className={`${styles.layer} ${summary ? styles.compactLayer : ""}`} data-privacy-summary={summary ? "" : undefined} aria-live="polite">
    <section ref={panelRef} tabIndex={-1} className={`${styles.panel} ${summary ? styles.summary : ""}`} aria-labelledby="privacy-choice-title" aria-describedby={saved ? undefined : "privacy-choice-copy"}>
      {summary ? <>
        <div className={styles.summaryText}>
          <div className={styles.summaryHeading}><ShieldCheck aria-hidden="true" /><h2 id="privacy-choice-title">Your privacy</h2></div>
          {saved ? savedMessage : <p id="privacy-choice-copy">{analyticsAlreadyEnabled ? "Your saved choice allows optional analytics. You can change it here. Necessary cookies keep KRAVIA working." : "Optional analytics stay off until you choose. Necessary cookies keep KRAVIA working."}</p>}
          {globalPrivacyControl && !saved ? <p className={styles.gpc}><Check aria-hidden="true" /> Global Privacy Control is active, so optional analytics remain off.</p> : null}
        </div>
        {!saved ? <div className={styles.summaryActions}>
          <button type="button" disabled={saving || globalPrivacyControl} onClick={() => saveChoice(true)}>Accept optional analytics</button>
          <button type="button" disabled={saving} onClick={() => saveChoice(false)}>Reject optional analytics</button>
          <button type="button" disabled={saving} onClick={() => setView("manage")}>Manage cookies</button>
        </div> : null}
      </> : <>
        <header className={styles.header}>
        <div className={styles.mark}><ShieldCheck aria-hidden="true" /></div>
        <div><p className={styles.kicker}>PRIVACY SETTINGS</p><h2 id="privacy-choice-title">Manage cookies</h2></div>
      </header>

      {saved ? savedMessage : <>
        <p id="privacy-choice-copy" className={styles.intro}>Choose whether KRAVIA may use optional analytics. Necessary technologies cannot be switched off because they support core site operation and security.</p>
        <div className={styles.preferenceList}>
          <div className={styles.preference}><div><strong>Necessary technologies</strong><span>Core site operation, security, and your saved preference.</span></div><em>Always on</em></div>
          <label className={styles.preference}><input type="checkbox" checked={optionalAnalytics} disabled={saving || globalPrivacyControl} onChange={(event) => setOptionalAnalytics(event.target.checked)} /><span className={styles.switch} aria-hidden="true" /><span><strong>Optional analytics</strong><small>Aggregated measurement that helps improve this website. It is off by default.</small></span></label>
        </div>
        {globalPrivacyControl ? <p className={styles.gpc}><Check aria-hidden="true" /> Global Privacy Control keeps optional analytics off.</p> : null}
        <div className={styles.choiceActions}>
          <button type="button" disabled={saving || globalPrivacyControl} onClick={() => saveChoice(true)}>Accept optional analytics</button>
          <button type="button" disabled={saving} onClick={() => saveChoice(false)}>Reject optional analytics</button>
        </div>
        <div className={styles.manageActions}><button type="button" className={styles.back} disabled={saving} onClick={() => setView("summary")}><ChevronLeft aria-hidden="true" /> Back</button><button type="button" className={styles.save} disabled={saving} onClick={() => saveChoice(optionalAnalytics)}>{saving ? "Saving…" : "Save selection"}</button></div>
      </>}
      </>}
      {state === "error" ? <div className={styles.feedback}><p className={styles.error} role="alert">We could not save your preference. Your saved settings have not changed. Optional analytics stay off unless you previously enabled them.</p><button type="button" className={styles.manage} onClick={() => setOpen(false)}>Close without saving</button></div> : null}
    </section>
  </aside>;
}
