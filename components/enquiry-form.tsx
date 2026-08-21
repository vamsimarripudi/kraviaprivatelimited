"use client";

import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { FormField } from "@/components/ui";
import type { PublicFormPresentation } from "@/lib/admin/site-control-types";

const categories = ["Business enquiry", "Product enquiry", "Partnership", "Media / corporate enquiry", "Careers", "Privacy", "Security", "General"] as const;
type FormErrors = Partial<Record<"name" | "email" | "message", string>>;
type EnquiryFormProps = { privacy?: boolean; initialCategory?: string; presentation?: PublicFormPresentation | null };

export function EnquiryForm({ privacy = false, initialCategory, presentation }: EnquiryFormProps) {
  const [category, setCategory] = useState(initialCategory ?? (privacy ? "Privacy question" : categories[0]));
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (status === "error") errorRef.current?.focus(); }, [status]);
  function validate(form: FormData) {
    const next: FormErrors = {}; const name = String(form.get("name") ?? "").trim(); const email = String(form.get("email") ?? "").trim(); const text = String(form.get("message") ?? "").trim();
    if (name.length < 2) next.name = "Enter your name so we know how to address you.";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (text.length < 10) next.message = "Add a little more detail so Kravia can route your request correctly.";
    setErrors(next); return Object.keys(next).length === 0;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); if (!validate(form)) return; setStatus("submitting"); setFormError(undefined);
    try {
      const response = await fetch(privacy ? "/api/privacy-requests" : "/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data !== "object" || !("reference" in data)) throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "We could not submit your request. Please try again.");
      setReference(String(data.reference)); setStatus("success");
    } catch (error) { setFormError(error instanceof Error ? error.message : "We could not submit your request. Please try again."); setStatus("error"); }
  }
  if (status === "success") return <section className="form-success" aria-labelledby="enquiry-success-title"><CheckCircle2 aria-hidden="true" /><div><p className="eyebrow">REQUEST RECEIVED</p><h2 id="enquiry-success-title">{presentation?.successHeading ?? "Your message is with Kravia."}</h2><p>{presentation?.successMessage ?? "Keep this reference if you need to follow up. The right team will review the information you provided."}</p><code>{reference}</code><div><Link href="/" className="button button-dark">Return to Kravia</Link><button type="button" className="text-button" onClick={() => { setStatus("idle"); setMessage(""); setReference(undefined); }}>Send another request</button></div></div></section>;
  const requestTypes = privacy ? ["Privacy question", "Access / information request", "Correction", "Erasure", "Consent-related request", "Grievance", "Security concern", "Other"] : categories;
  return <form onSubmit={submit} className="form-card" noValidate aria-busy={status === "submitting"}><input type="hidden" name="privacyAcknowledged" value="true" /><div className="form-grid"><FormField label="Name" required error={errors.name}>{inputProps => <input {...inputProps} required name="name" autoComplete="name" onChange={() => setErrors(current => ({ ...current, name: undefined }))} />}</FormField><FormField label="Work email" required error={errors.email}>{inputProps => <input {...inputProps} required name="email" type="email" inputMode="email" autoComplete="email" onChange={() => setErrors(current => ({ ...current, email: undefined }))} />}</FormField><FormField label={privacy ? "Request type" : "What is this about?"}>{inputProps => <select {...inputProps} name={privacy ? "requestType" : "category"} value={category} onChange={event => setCategory(event.target.value)}>{requestTypes.map(item => <option key={item}>{item}</option>)}</select>}</FormField><FormField label="Organisation" description="Optional">{inputProps => <input {...inputProps} name="organisation" autoComplete="organization" />}</FormField></div><FormField className="form-message" label="How can we help?" required error={errors.message} description="Please do not include passwords, private keys or other sensitive credentials.">{inputProps => <textarea {...inputProps} required name="message" rows={6} maxLength={4000} value={message} onChange={event => { setMessage(event.target.value); setErrors(current => ({ ...current, message: undefined })); }} />}</FormField><p className="form-notice">We use the information you provide to respond to this request. <Link href="/trust/data-protection">Learn how Kravia handles personal information.</Link></p>{status === "error" && <div className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{formError}</div>}<button className="button button-dark" type="submit" disabled={status === "submitting"}>{status === "submitting" && <LoaderCircle className="spin" aria-hidden="true" />} {status === "submitting" ? "Sending request…" : presentation?.submitLabel ?? "Submit request"}</button></form>;
}
