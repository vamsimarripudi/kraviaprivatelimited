"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, MapPinOff, MonitorCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import styles from "./office-device-approval-form.module.css";

type Review = {
  status: "PENDING" | "APPROVED" | "DECLINED" | "EXPIRED";
  deviceLabel: string;
  sourceAddress: string;
  requestedAt: string;
  expiresAt: string;
};

function displayTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function OfficeDeviceApprovalForm() {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDecision, setPendingDecision] = useState<"APPROVE" | "DECLINE" | null>(null);
  const [result, setResult] = useState<"APPROVED" | "DECLINED" | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/office-auth/device-approval/review", { credentials: "same-origin", cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || typeof body.deviceLabel !== "string" || typeof body.sourceAddress !== "string" || typeof body.requestedAt !== "string" || typeof body.expiresAt !== "string") {
          throw new Error(typeof body.detail === "string" ? body.detail : "Unable to review this device request");
        }
        if (!active) return;
        setReview(body as Review);
        if (body.status === "APPROVED" || body.status === "DECLINED") setResult(body.status);
        if (body.status === "EXPIRED") setError("This device approval request has expired. Start a new sign-in from the original device.");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to review this device request");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function decide(decision: "APPROVE" | "DECLINE") {
    setPendingDecision(decision);
    setError(undefined);
    try {
      const response = await fetch("/api/office-auth/device-approval/action", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || (body.status !== "APPROVED" && body.status !== "DECLINED")) {
        throw new Error(typeof body.detail === "string" ? body.detail : "Unable to decide this device request");
      }
      setResult(body.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to decide this device request");
    } finally {
      setPendingDecision(null);
    }
  }

  if (loading) return <section className={styles.loading} aria-live="polite"><LoaderCircle size={22} aria-hidden="true" /><span>Loading the protected device request…</span></section>;

  if (result) {
    const approved = result === "APPROVED";
    return (
      <section className={styles.result} aria-live="polite">
        <div className={approved ? styles.resultIconApproved : styles.resultIconDeclined}>{approved ? <CheckCircle2 size={25} aria-hidden="true" /> : <ShieldAlert size={25} aria-hidden="true" />}</div>
        <p className={styles.eyebrow}>{approved ? "DEVICE TRUSTED" : "SIGN-IN BLOCKED"}</p>
        <h1>{approved ? "The original device is trusted." : "The device has been blocked."}</h1>
        <p>{approved ? "Return to the exact phone or browser where you entered the email code. It will continue automatically; this browser never becomes signed in." : "The pending sign-in has been ended. If this was you, start a new request from the original device."}</p>
        <Link href="/office/login" className={styles.returnLink}>Back to KRAVIA Office sign in</Link>
      </section>
    );
  }

  if (!review || error) {
    return <section className={styles.result} aria-live="polite"><div className={styles.resultIconDeclined}><ShieldAlert size={25} aria-hidden="true" /></div><p className={styles.eyebrow}>REQUEST UNAVAILABLE</p><h1>We could not open this request.</h1><p role="alert">{error ?? "Start a new sign-in from the original device."}</p><Link href="/office/login" className={styles.returnLink}>Back to KRAVIA Office sign in</Link></section>;
  }

  return (
    <section className={styles.form}>
      <div className={styles.heroIcon}><ShieldCheck size={25} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>DEVICE REVIEW</p>
      <h1>Is this your sign-in?</h1>
      <p className={styles.intro}>Review these details before granting the original device access. Trust is limited to that exact device and replaces any previously trusted device.</p>
      <dl className={styles.details}>
        <div><dt><MonitorCheck size={16} aria-hidden="true" />Device</dt><dd>{review.deviceLabel}</dd></div>
        <div><dt>Network address observed by KRAVIA</dt><dd>{review.sourceAddress}</dd></div>
        <div><dt><MapPinOff size={16} aria-hidden="true" />Approximate location</dt><dd>Not available — no independently verified location was provided.</dd></div>
        <div><dt>Requested</dt><dd>{displayTime(review.requestedAt)}</dd></div>
        <div><dt>Expires</dt><dd>{displayTime(review.expiresAt)}</dd></div>
      </dl>
      <p className={styles.notice}>Choosing Trust permits only the original phone or browser to complete this sign-in. This email page cannot access KRAVIA Office.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.trustButton} disabled={pendingDecision !== null} onClick={() => void decide("APPROVE")}>
          {pendingDecision === "APPROVE" ? <LoaderCircle size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />} Trust this device
        </button>
        <button type="button" className={styles.blockButton} disabled={pendingDecision !== null} onClick={() => void decide("DECLINE")}>
          {pendingDecision === "DECLINE" ? <LoaderCircle size={18} aria-hidden="true" /> : <ShieldAlert size={18} aria-hidden="true" />} Cancel and block sign-in
        </button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}
