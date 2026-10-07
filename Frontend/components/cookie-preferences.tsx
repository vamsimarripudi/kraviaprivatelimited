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
    if (open) panelRef.current?.focus({ preventScroll: true });
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
  return <aside className={styles.layer} aria-live="polite">
    <section ref={panelRef} tabIndex={-1} className={styles.panel} aria-labelledby="privacy-choice-title" aria-describedby="privacy-choice-copy">
      <header className={styles.header}>
        <div className={styles.mark}><ShieldCheck aria-hidden="true" /></div>
        <div><p className={styles.kicker}>PRIVACY SETTINGS</p><h2 id="privacy-choice-title">{view === "manage" ? "Manage cookies" : "Your choice, clearly."}</h2></div>
      </header>

      {saved ? <div className={styles.saved} role="status"><Check aria-hidden="true" /><div><strong>Preferences saved</strong><span>{optionalAnalytics ? "Optional analytics are enabled." : "Optional analytics remain off."}</span></div></div> : view === "summary" ? <>
        <p id="privacy-choice-copy" className={styles.intro}>Necessary technologies keep KRAVIA working. Optional analytics are off unless you choose to enable them.</p>
        {globalPrivacyControl ? <p className={styles.gpc}><Check aria-hidden="true" /> Global Privacy Control is active, so optional analytics remain off.</p> : null}
        <div className={styles.choiceActions}>
          <button type="button" disabled={saving || globalPrivacyControl} onClick={() => saveChoice(true)}>Accept optional analytics</button>
          <button type="button" disabled={saving} onClick={() => saveChoice(false)}>Reject optional analytics</button>
        </div>
        <button type="button" className={styles.manage} disabled={saving} onClick={() => setView("manage")}>Manage cookies</button>
      </> : <>
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
      {state === "error" ? <p className={styles.error} role="alert">We could not save your preference. Optional analytics remain off. Please try again.</p> : null}
    </section>
  </aside>;
}
