"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { savePublicFormSetting } from "@/app/admin/actions";
import { publicFormKeys, type PublicFormKey, type PublicFormSetting } from "@/lib/admin/site-control-types";

const labels: Record<PublicFormKey, { title: string; detail: string; route: string }> = {
  CONTACT: { title: "Contact enquiry", detail: "The public contact route and its enquiry handoff.", route: "/contact" },
  SUPPORT: { title: "Support & tracking", detail: "The customer support-case creation experience.", route: "/support" },
  TRUST_REQUEST: { title: "Trust & DPDP request", detail: "The restricted privacy, accessibility and security intake route.", route: "/privacy-request" },
};

type Draft = { title: string; intro: string; submitLabel: string; successHeading: string; successMessage: string; isEnabled: boolean };
function blankDraft(setting?: PublicFormSetting): Draft { return { title: setting?.title ?? "", intro: setting?.intro ?? "", submitLabel: setting?.submitLabel ?? "", successHeading: setting?.successHeading ?? "", successMessage: setting?.successMessage ?? "", isEnabled: setting?.isEnabled ?? true }; }

export function AdminFormSettings({ schemaReady, settings }: { schemaReady: boolean; settings: PublicFormSetting[] }) {
  const initial = useMemo(() => Object.fromEntries(publicFormKeys.map((key) => [key, blankDraft(settings.find((setting) => setting.formKey === key))])) as Record<PublicFormKey, Draft>, [settings]);
  const [drafts, setDrafts] = useState(initial);
  const [active, setActive] = useState<PublicFormKey>("CONTACT");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const draft = drafts[active];
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDrafts((current) => ({ ...current, [active]: { ...current[active], [key]: value } })); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(undefined);
    startTransition(async () => {
      try { await savePublicFormSetting({ formKey: active, ...draft }); setMessage("Saved. The public route now uses this governed presentation copy."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "The configuration could not be saved."); }
    });
  }
  return <section className="admin-form-settings" aria-label="Public form presentation controls">
    {!schemaReady ? <div className="admin-schema-warning"><TriangleAlert aria-hidden="true" /><div><strong>Site-control migration required</strong><p>Apply <code>202608200004_admin_site_control.sql</code> in Supabase before saving form presentation. Existing public forms remain live and unaffected until then.</p></div></div> : null}
    <div className="admin-form-tabs" role="tablist" aria-label="Public forms">
      {publicFormKeys.map((key) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => { setActive(key); setMessage(undefined); }}><span>{labels[key].title}</span><small>{settings.some((item) => item.formKey === key) ? "Configured" : "Using route default"}</small></button>)}
    </div>
    <form onSubmit={submit} className="admin-form-editor">
      <header><div><p className="eyebrow">PUBLIC PRESENTATION</p><h2>{labels[active].title}</h2><p>{labels[active].detail} Request handling, recipient access, validation and retention remain controlled by the backend.</p></div><a className="text-link" href={labels[active].route} target="_blank" rel="noreferrer">Preview public route ↗</a></header>
      <label className="admin-switch"><input type="checkbox" checked={draft.isEnabled} onChange={(event) => update("isEnabled", event.target.checked)} /><span aria-hidden="true" /><b>Use managed public copy</b></label>
      <div className="admin-field-grid">
        <label>Form heading<input value={draft.title} onChange={(event) => update("title", event.target.value)} maxLength={140} placeholder="Uses the route default when blank" /></label>
        <label>Submit label<input value={draft.submitLabel} onChange={(event) => update("submitLabel", event.target.value)} maxLength={80} placeholder="Uses the route default when blank" /></label>
        <label className="admin-field-wide">Introduction<textarea value={draft.intro} onChange={(event) => update("intro", event.target.value)} maxLength={600} rows={4} placeholder="A clear, public explanation of the form's purpose." /></label>
        <label>Success heading<input value={draft.successHeading} onChange={(event) => update("successHeading", event.target.value)} maxLength={140} placeholder="Uses the route default when blank" /></label>
        <label>Success message<textarea value={draft.successMessage} onChange={(event) => update("successMessage", event.target.value)} maxLength={600} rows={3} placeholder="Uses the route default when blank" /></label>
      </div>
      <footer><p>Only public-facing copy is editable here. Case routing and private records are not exposed by this form.</p><button className="button button-dark" disabled={pending || !schemaReady}>{pending ? <LoaderCircle className="spin" /> : <Save />}{pending ? "Saving…" : "Save public form"}</button></footer>
      {message ? <p className={`admin-action-message ${message.startsWith("Saved") ? "is-success" : "is-error"}`} role="status">{message.startsWith("Saved") ? <CheckCircle2 /> : <TriangleAlert />}{message}</p> : null}
    </form>
  </section>;
}
