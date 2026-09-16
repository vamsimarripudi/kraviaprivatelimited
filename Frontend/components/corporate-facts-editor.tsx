"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { createCorporateFact } from "@/app/admin/company/actions";
import { publicFactKeys, publicFactLabels, type PublicFactKey } from "@/lib/corporate/facts-schema";

type Fact = { id: string; fact_key: PublicFactKey; value: unknown; visibility: "PUBLIC" | "PRIVATE"; verification_status: string; effective_from: string | null; verification_source: string | null; updated_at: string };

export function CorporateFactsEditor({ facts }: { facts: readonly Fact[] }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [factKey, setFactKey] = useState<PublicFactKey>("legal_name");
  const isBoolean = factKey === "gst_registered";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    try {
      await createCorporateFact({ factKey, value: String(form.get("value") ?? "").trim(), verificationStatus: String(form.get("verificationStatus") ?? "UNVERIFIED") as "UNVERIFIED" | "DOCUMENT_VERIFIED" | "PROFESSIONAL_VERIFIED" | "DIRECTOR_APPROVED" | "PUBLIC_APPROVED", verificationSource: String(form.get("verificationSource") ?? "").trim(), effectiveFrom: String(form.get("effectiveFrom") ?? "") || undefined });
      event.currentTarget.reset();
      setFactKey("legal_name");
      setMessage("Corporate fact recorded. It remains private unless it has explicit PUBLIC APPROVED status.");
    } catch {
      setMessage("The fact could not be recorded. Confirm the evidence source, your role, and MFA step-up.");
    } finally {
      setPending(false);
    }
  }

  return <section className="corporate-facts-editor"><header><div><p className="eyebrow">CANONICAL COMPANY FACTS</p><h2>Change facts with evidence, not copy edits.</h2><p>Each change creates a new dated record. The public site reads only values that are explicitly public, approved, and effective.</p></div><ShieldCheck aria-hidden="true" /></header><form onSubmit={submit} className="corporate-facts-form"><label>Fact<select value={factKey} onChange={(event) => setFactKey(event.target.value as PublicFactKey)}>{publicFactKeys.map((key) => <option key={key} value={key}>{publicFactLabels[key]}</option>)}</select></label><label>{isBoolean ? "Value" : "Verified value"}{isBoolean ? <select name="value" defaultValue="false"><option value="true">Registered</option><option value="false">Not registered</option></select> : <input name="value" required maxLength={2000} />}</label><label>Verification status<select name="verificationStatus" defaultValue="UNVERIFIED"><option>UNVERIFIED</option><option>DOCUMENT_VERIFIED</option><option>PROFESSIONAL_VERIFIED</option><option>DIRECTOR_APPROVED</option><option>PUBLIC_APPROVED</option></select></label><label>Effective from<input name="effectiveFrom" type="date" /></label><label className="fact-wide">Evidence / approval source<input name="verificationSource" required minLength={3} maxLength={500} placeholder="Evidence document or approval reference" /></label><p className="fact-governance-note">Selecting <strong>PUBLIC APPROVED</strong> makes this fact eligible for the public projection. It does not validate the claim; use only after the appropriate evidence and approval exist.</p>{message ? <p className="content-status" role="status">{message}</p> : null}<button className="button button-dark" disabled={pending}>{pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{pending ? "Recording…" : "Record governed fact"}</button></form><section className="fact-history" aria-labelledby="fact-history-title"><p className="eyebrow">RECENT FACT HISTORY</p><h3 id="fact-history-title">Evidence-backed changes</h3>{facts.length ? <ol>{facts.map((fact) => <li key={fact.id}><div><strong>{publicFactLabels[fact.fact_key]}</strong><span>{typeof fact.value === "boolean" ? fact.value ? "Registered" : "Not registered" : String(fact.value)}</span></div><div><small>{fact.verification_status.replaceAll("_", " ")} · {fact.visibility}</small><time dateTime={fact.updated_at}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(fact.updated_at))}</time></div></li>)}</ol> : <p>No company facts have been recorded in the database yet.</p>}</section></section>;
}