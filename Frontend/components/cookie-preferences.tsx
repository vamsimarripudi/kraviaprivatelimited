"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ShieldCheck, X } from "lucide-react";
import { privacyCookieFromDocument } from "@/lib/privacy/choices";
import styles from "./cookie-preferences.module.css";

type PreferenceState = "loading" | "ready" | "saving" | "saved" | "error";

function globalPrivacyControlActive() {
  return Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
}

export function CookiePreferences() {
  const [state, setState] = useState<PreferenceState>("loading");
  const [open, setOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [optionalAnalytics, setOptionalAnalytics] = useState(false);
  const [globalPrivacyControl, setGlobalPrivacyControl] = useState(false);

  useEffect(() => {
    const saved = privacyCookieFromDocument(document.cookie);
    setGlobalPrivacyControl(globalPrivacyControlActive());
    setOptionalAnalytics(saved?.optionalAnalytics === true && !globalPrivacyControlActive());
    setOpen(!saved);
    setState("ready");
  }, []);

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
      setOpen(false);
      setShowOptions(false);
      window.dispatchEvent(new CustomEvent("kravia:privacy-choices", { detail: { optionalAnalytics: nextOptionalAnalytics } }));
      if (priorOptionalAnalytics && !nextOptionalAnalytics) window.setTimeout(() => window.location.reload(), 50);
    } catch {
      setState("error");
      setOpen(true);
    }
  }

  if (state === "loading") return null;

  return <>
    {open ? <section className={styles.panel} aria-labelledby="privacy-choice-title" aria-live="polite">
      <div className={styles.icon}><ShieldCheck aria-hidden="true" /></div>
      <div className={styles.copy}>
        <p className="eyebrow">PRIVACY CHOICES</p>
        <h2 id="privacy-choice-title">Your privacy choices.</h2>
        <p>Necessary technologies help this site work. Optional technologies are off until you choose them. You can change your choices later.</p>
        {globalPrivacyControl ? <p className={styles.gpc}><Check aria-hidden="true" /> Your browser’s Global Privacy Control is active. Optional technologies remain off.</p> : null}
        <div className={styles.actions}>
          {!globalPrivacyControl ? <button type="button" className="button button-dark" disabled={state === "saving"} onClick={() => saveChoice(true)}>Accept optional</button> : null}
          <button type="button" className={styles.secondary} disabled={state === "saving"} onClick={() => saveChoice(false)}>{globalPrivacyControl ? "Save required-only choice" : "Reject optional"}</button>
          <button type="button" className={styles.manage} disabled={state === "saving"} onClick={() => setShowOptions((visible) => !visible)} aria-expanded={showOptions}>Manage preferences <ChevronDown aria-hidden="true" /></button>
        </div>
        {showOptions ? <div className={styles.options}>
          <label><input type="checkbox" checked disabled readOnly /> Necessary technologies <span>Always active for core site operation.</span></label>
          <label><input type="checkbox" checked={optionalAnalytics} disabled={globalPrivacyControl} onChange={(event) => setOptionalAnalytics(event.target.checked)} /> Optional analytics <span>Helps us understand aggregated use of this website.</span></label>
          <button type="button" className={styles.secondary} disabled={state === "saving"} onClick={() => saveChoice(optionalAnalytics)}>Save choices</button>
        </div> : null}
        {state === "error" ? <p className={styles.error} role="alert">We could not save your choice. Optional technologies remain off. Please try again.</p> : null}
      </div>
    </section> : null}
    <button type="button" className={styles.reopen} onClick={() => setOpen(true)} aria-expanded={open}>
      <ShieldCheck aria-hidden="true" /> Privacy choices
    </button>
    {state === "saved" ? <p className={styles.status} role="status">Your privacy choices have been saved.</p> : null}
  </>;
}
