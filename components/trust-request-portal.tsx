"use client";

import { CheckCircle2, Copy, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

const requestTypes = ["Privacy question", "Access / information request", "Correction", "Erasure", "Consent-related request", "Grievance", "Accessibility feedback", "Security concern", "Other"];

type CreatedCase = { reference: string; trackingCode: string };

export function TrustRequestPortal({ securityOnly = false }: { securityOnly?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<CreatedCase>();
  const [copied, setCopied] = useState(false);
  const choices = securityOnly ? ["Security concern"] : requestTypes;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(undefined); setCreated(undefined);
    const response = await fetch("/api/support/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) { setError(data.error ?? "We could not record your request."); return; }
    setCreated(data); event.currentTarget.reset();
  }

  async function copy(value: string) { await navigator.clipboard?.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }

  return <section className="trust-request-panel" aria-labelledby="trust-request-title"><div><p className="eyebrow">RESTRICTED REQUEST CHANNEL</p><h2 id="trust-request-title">{securityOnly ? "Report a security concern." : "Trust & DPDP request."}</h2><p>{securityOnly ? "Security reports are routed to a restricted review queue. Do not include passwords, private keys, one-time codes or customer data in the initial report." : "Privacy, DPDP, accessibility and trust requests are separated from general support and routed only to authorised reviewers."}</p></div><form onSubmit={submit} className="form-card trust-request-form"><input type="hidden" name="privacyAcknowledged" value="true" /><div className="form-grid"><label>Name<input required name="name" autoComplete="name" /></label><label>Email<input required name="email" type="email" autoComplete="email" /></label><label>Request type<select name="requestType" defaultValue={choices[0]}>{choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label><label>Organisation <input name="organisation" autoComplete="organization" /></label></div><label>Subject<input required name="subject" minLength={4} maxLength={180} /></label><label>How can Kravia help?<textarea required name="description" minLength={10} maxLength={8000} rows={5} /></label><label className="support-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><p className="form-notice"><ShieldCheck /> We use these details only to assess and respond to this request. <Link href="/trust/privacy">Read the Privacy approach.</Link></p><button className="button button-dark" type="submit" disabled={pending}>{pending ? <><LoaderCircle className="spin" /> Creating private case…</> : "Create private request"}</button>{error && <p className="support-error" role="alert">{error}</p>}{created && <div className="support-success" role="status"><CheckCircle2 /><div><strong>Private request created.</strong><p>Save both values. Kravia does not display the tracking code again.</p><dl><div><dt>Reference</dt><dd><code>{created.reference}</code><button type="button" onClick={() => copy(created.reference)} aria-label="Copy request reference"><Copy /></button></dd></div><div><dt>Tracking code</dt><dd><code>{created.trackingCode}</code><button type="button" onClick={() => copy(created.trackingCode)} aria-label="Copy request tracking code"><Copy /></button></dd></div></dl><small>{copied ? "Copied to clipboard." : "Use both values at Support & case tracking to view customer-visible progress."}</small></div></div>}</form></section>;
}