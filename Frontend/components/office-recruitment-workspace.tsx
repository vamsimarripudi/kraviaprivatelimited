"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness, CalendarDays, CheckCircle2, CircleAlert, FileCheck2, LoaderCircle,
  Plus, RefreshCw, Send, ShieldCheck, Upload, UserPlus, Users, X,
} from "lucide-react";
import styles from "./office-recruitment-workspace.module.css";

type Capabilities = {
  read_requisitions: boolean; manage_requisitions: boolean; manage_candidates: boolean; manage_interviews: boolean;
  prepare_offer: boolean; review_offer: boolean; manage_onboarding: boolean;
};
type Person = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null };
type Position = { code: string; label: string; department_code: string; is_manager: boolean };
type Department = { code: string; label: string };
type Requisition = {
  id: string; requisition_code: string; position_code: string; department_code: string; hiring_manager_user_id: string; openings: number;
  employment_type: string; work_mode: string; location_text?: string | null; budget_min_minor?: number | null; budget_max_minor?: number | null;
  currency?: string | null; business_reason: string; status: string; approval_request_id?: string | null; created_at: string;
};
type Candidate = {
  id: string; candidate_code: string; requisition_id: string; full_name: string; email: string; phone?: string | null; location_text?: string | null;
  source_channel: string; source_reference?: string | null; status: string; owner_user_id: string; updated_at: string;
};
type Interview = {
  id: string; candidate_id: string; stage_code: string; title: string; interviewer_user_id: string; scheduled_start: string;
  scheduled_end?: string | null; location_or_link?: string | null; status: string;
};
type Feedback = { id: string; interview_id: string; interviewer_user_id: string; outcome: string; evidence_note: string; strengths?: string | null; concerns?: string | null; submitted_at: string };
type Offer = {
  id: string; offer_code: string; candidate_id: string; requisition_id: string; position_code: string; department_code: string; reporting_manager_user_id: string;
  employment_type: string; work_mode: string; joining_date: string; grade_code?: string | null; annual_ctc_minor: number; monthly_gross_minor: number;
  currency: string; probation_months?: number | null; valid_until?: string | null; status: string; approval_request_id?: string | null;
  offer_document_instance_id?: string | null; pre_onboarding_request_id?: string | null;
};
type DocumentRequest = { id: string; candidate_id: string; document_type: string; label: string; required: boolean; status: string; storage_reference?: string | null; source_reference?: string | null; sha256?: string | null; mime_type?: string | null; byte_size?: number | null; original_filename?: string | null; note?: string | null };
type Approval = { id: string; status: string; current_step_order?: number | null };
type Payload = {
  actor: { user_id: string }; scope: { type?: string | null; key?: string | null }; capabilities: Capabilities;
  identities: Person[]; positions: Position[]; departments: Department[]; requisitions: Requisition[]; candidates: Candidate[];
  interviews: Interview[]; feedback: Feedback[]; offers: Offer[]; documents: DocumentRequest[]; approvals: Approval[]; disclaimer: string;
};
type View = "requisitions" | "candidates" | "interviews" | "offers";
type Modal =
  | { kind: "REQUISITION" }
  | { kind: "CANDIDATE"; requisition?: Requisition }
  | { kind: "TRANSITION"; candidate: Candidate }
  | { kind: "INTERVIEW"; candidate: Candidate }
  | { kind: "FEEDBACK"; interview: Interview }
  | { kind: "DOCUMENT"; candidate: Candidate }
  | { kind: "UPLOAD_DOCUMENT"; document: DocumentRequest }
  | { kind: "OFFER"; candidate: Candidate }
  | { kind: "ACCEPT"; offer: Offer };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-recruitment", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Recruitment request failed");
  return body as T;
}
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()); }
function date(value?: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
function money(value?: number | null, currency = "INR") { if (typeof value !== "number") return "—"; try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100); } catch { return `${currency} ${(value / 100).toLocaleString("en-IN")}`; } }
function minor(value: string) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined; }

export function OfficeRecruitmentWorkspace() {
  const [data, setData] = useState<Payload>();
  const [view, setView] = useState<View>("requisitions");
  const [modal, setModal] = useState<Modal>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [query, setQuery] = useState("");
  const [uploadFile, setUploadFile] = useState<File>();

  async function reload(message?: string) {
    const next = await api<Payload>();
    setData(next);
    if (message) setNotice(message);
  }
  useEffect(() => {
    let alive = true;
    void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load recruitment workspace"); });
    return () => { alive = false; };
  }, []);

  const people = useMemo(() => new Map((data?.identities ?? []).map((item) => [item.user_id, item])), [data?.identities]);
  const reqs = useMemo(() => new Map((data?.requisitions ?? []).map((item) => [item.id, item])), [data?.requisitions]);
  const candidates = useMemo(() => new Map((data?.candidates ?? []).map((item) => [item.id, item])), [data?.candidates]);
  const approvals = useMemo(() => new Map((data?.approvals ?? []).map((item) => [item.id, item])), [data?.approvals]);
  const needle = query.trim().toLowerCase();
  const filteredReqs = (data?.requisitions ?? []).filter((item) => !needle || `${item.requisition_code} ${item.position_code} ${item.department_code} ${item.status}`.toLowerCase().includes(needle));
  const filteredCandidates = (data?.candidates ?? []).filter((item) => !needle || `${item.candidate_code} ${item.full_name} ${item.email} ${item.status}`.toLowerCase().includes(needle));

  function person(id: string) { const row = people.get(id); return row?.display_name || row?.job_title || "Assigned user"; }
  async function action(payload: Record<string, unknown>, message: string) {
    setBusy(true); setError(undefined);
    try { await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); await reload(message); setModal(undefined); setDraft({}); setUploadFile(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Recruitment update failed"); }
    finally { setBusy(false); }
  }
  function openRequisition() {
    const firstPosition = data?.positions[0]; setDraft({ position: firstPosition?.code || "", department: firstPosition?.department_code || data?.departments[0]?.code || "", manager_user_id: data?.actor.user_id || "", openings: "1", employment_type: "EMPLOYEE", work_mode: "OFFICE", currency: "INR" }); setModal({ kind: "REQUISITION" });
  }
  function openCandidate(requisition?: Requisition) { setDraft({ requisition_id: requisition?.id || data?.requisitions.find((r) => r.status === "OPEN")?.id || "", source_channel: "DIRECT" }); setModal({ kind: "CANDIDATE", requisition }); }

  async function uploadDocument(document: DocumentRequest) {
    if (!uploadFile) return setError("Choose a PDF, JPEG, PNG or WebP file.");
    setBusy(true); setError(undefined);
    try {
      const form = new FormData();
      form.set("request_id", document.id);
      form.set("file", uploadFile);
      if (draft.source_reference?.trim()) form.set("source_reference", draft.source_reference.trim());
      const response = await fetch("/api/office-recruitment/documents", { method: "POST", body: form, credentials: "same-origin" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Candidate document upload failed");
      await reload("Candidate document stored in the private recruitment vault and moved to review.");
      setModal(undefined); setDraft({}); setUploadFile(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Candidate document upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return;
    if (modal.kind === "UPLOAD_DOCUMENT") return uploadDocument(modal.document);
    if (modal.kind === "REQUISITION") {
      const min = draft.budget_min ? minor(draft.budget_min) : undefined; const max = draft.budget_max ? minor(draft.budget_max) : undefined;
      return action({ action: "CREATE_REQUISITION", position: draft.position, department: draft.department, manager_user_id: draft.manager_user_id, openings: Number(draft.openings || 1), employment_type: draft.employment_type, work_mode: draft.work_mode, location: draft.location || undefined, budget_min_minor: min, budget_max_minor: max, currency: draft.currency || undefined, reason: draft.reason }, "Hiring requisition drafted. Headcount and budget are not approved until the workflow completes.");
    }
    if (modal.kind === "CANDIDATE") return action({ action: "CREATE_CANDIDATE", requisition_id: draft.requisition_id, name: draft.name, email: draft.email, phone: draft.phone || undefined, location: draft.location || undefined, source_channel: draft.source_channel || "DIRECT", source_reference: draft.source_reference || undefined }, "Candidate added to the governed hiring pipeline.");
    if (modal.kind === "TRANSITION") return action({ action: "TRANSITION_CANDIDATE", candidate_id: modal.candidate.id, status: draft.status, note: draft.note || undefined }, "Candidate stage updated with an auditable event.");
    if (modal.kind === "INTERVIEW") return action({ action: "SCHEDULE_INTERVIEW", candidate_id: modal.candidate.id, stage: draft.stage, title: draft.title, interviewer_user_id: draft.interviewer_user_id, starts_at: new Date(draft.starts_at).toISOString(), ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : undefined, location: draft.location || undefined }, "Interview scheduled inside KRAVIA Office.");
    if (modal.kind === "FEEDBACK") return action({ action: "SUBMIT_FEEDBACK", interview_id: modal.interview.id, outcome: draft.outcome, evidence: draft.evidence, strengths: draft.strengths || undefined, concerns: draft.concerns || undefined }, "Interview feedback recorded as evidence.");
    if (modal.kind === "DOCUMENT") return action({ action: "REQUEST_DOCUMENT", candidate_id: modal.candidate.id, document_type: draft.document_type, label: draft.label, required: draft.required !== "false" }, "Candidate document request created.");
    if (modal.kind === "OFFER") {
      const annual = minor(draft.annual_ctc); const monthly = minor(draft.monthly_gross);
      if (annual === undefined || monthly === undefined) return setError("Enter valid compensation values.");
      return action({ action: "CREATE_OFFER", candidate_id: modal.candidate.id, manager_user_id: draft.manager_user_id, joining_date: draft.joining_date, grade: draft.grade || undefined, annual_ctc_minor: annual, monthly_gross_minor: monthly, currency: draft.currency || "INR", probation_months: draft.probation_months ? Number(draft.probation_months) : undefined, variable_pay_note: draft.variable_pay_note || undefined, special_condition_note: draft.special_condition_note || undefined, valid_until: draft.valid_until ? new Date(draft.valid_until).toISOString() : undefined }, "Offer proposal drafted. It still requires independent approval.");
    }
    if (modal.kind === "ACCEPT") return action({ action: "MARK_OFFER_ACCEPTED", offer_id: modal.offer.id, evidence_reference: draft.evidence_reference }, "Offer acceptance recorded and pre-onboarding approval created.");
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Recruitment workspace unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading recruitment</h2><p>Resolving hiring authority and canonical records.</p></div></section>;

  const openRoles = data.requisitions.filter((r) => r.status === "OPEN").length;
  const pipeline = data.candidates.filter((c) => !["REJECTED","WITHDRAWN","DECLINED","HIRED"].includes(c.status)).length;
  const pendingOffers = data.offers.filter((o) => ["DRAFT","PENDING_APPROVAL","APPROVED","DOCUMENT_READY","OFFERED"].includes(o.status)).length;

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div><p>PEOPLE · RECRUITMENT</p><h2>Headcount to accepted offer, without leaving KRAVIA Office.</h2><span>{data.disclaimer}</span></div>
      <div className={styles.metrics}><article><b>{openRoles}</b><span>open roles</span></article><article><b>{pipeline}</b><span>active candidates</span></article><article><b>{pendingOffers}</b><span>offer actions</span></article></div>
    </header>

    <div className={styles.toolbar}>
      <div className={styles.tabs}>{(["requisitions","candidates","interviews","offers"] as View[]).map((item) => <button key={item} type="button" data-active={view === item} onClick={() => setView(item)}>{label(item)}</button>)}</div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search hiring records" />
      <div>{data.capabilities.manage_requisitions ? <button type="button" onClick={openRequisition}><Plus /> Requisition</button> : null}{data.capabilities.manage_candidates ? <button type="button" onClick={() => openCandidate()}><UserPlus /> Candidate</button> : null}</div>
    </div>
    {notice ? <div className={styles.notice}><CheckCircle2 />{notice}<button type="button" onClick={() => setNotice(undefined)}><X /></button></div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}

    {view === "requisitions" ? <div className={styles.grid}>{filteredReqs.map((item) => <article key={item.id} className={styles.card}>
      <header><div><code>{item.requisition_code}</code><h3>{item.position_code}</h3><span>{item.department_code} · {item.employment_type} · {item.work_mode}</span></div><em data-status={item.status}>{label(item.status)}</em></header>
      <p>{item.business_reason}</p>
      <dl><div><dt>Openings</dt><dd>{item.openings}</dd></div><div><dt>Manager</dt><dd>{person(item.hiring_manager_user_id)}</dd></div><div><dt>Budget</dt><dd>{money(item.budget_min_minor,item.currency || "INR")} – {money(item.budget_max_minor,item.currency || "INR")}</dd></div>{item.approval_request_id ? <div><dt>Approval</dt><dd>{label(approvals.get(item.approval_request_id)?.status || "Pending")}</dd></div> : null}</dl>
      <footer>{data.capabilities.manage_requisitions && ["DRAFT","REJECTED"].includes(item.status) ? <button type="button" onClick={() => action({ action: "SUBMIT_REQUISITION", requisition_id: item.id }, "Headcount approval request submitted.")}><Send /> Submit</button> : null}{item.approval_request_id ? <button type="button" onClick={() => action({ action: "SYNC_REQUISITION", requisition_id: item.id }, "Requisition approval status synchronized.")}><RefreshCw /> Sync</button> : null}{data.capabilities.manage_candidates && item.status === "OPEN" ? <button type="button" onClick={() => openCandidate(item)}><UserPlus /> Add candidate</button> : null}</footer>
    </article>)}{!filteredReqs.length ? <div className={styles.empty}><BriefcaseBusiness /><b>No requisitions in scope</b><span>KRAVIA does not fabricate sample hiring records.</span></div> : null}</div> : null}

    {view === "candidates" ? <div className={styles.grid}>{filteredCandidates.map((item) => <article key={item.id} className={styles.card}>
      <header><div><code>{item.candidate_code}</code><h3>{item.full_name}</h3><span>{item.email} · {reqs.get(item.requisition_id)?.position_code || "Requisition"}</span></div><em data-status={item.status}>{label(item.status)}</em></header>
      <dl><div><dt>Owner</dt><dd>{person(item.owner_user_id)}</dd></div><div><dt>Source</dt><dd>{label(item.source_channel)}</dd></div><div><dt>Updated</dt><dd>{date(item.updated_at)}</dd></div></dl>
      <footer>
        {data.capabilities.manage_candidates ? <button type="button" onClick={() => { setDraft({ status: item.status }); setModal({ kind: "TRANSITION", candidate: item }); }}><RefreshCw /> Stage</button> : null}
        {data.capabilities.manage_interviews ? <button type="button" onClick={() => { setDraft({ stage: "TECHNICAL", interviewer_user_id: data.actor.user_id }); setModal({ kind: "INTERVIEW", candidate: item }); }}><CalendarDays /> Interview</button> : null}
        {data.capabilities.manage_candidates ? <button type="button" onClick={() => { setDraft({ required: "true" }); setModal({ kind: "DOCUMENT", candidate: item }); }}><FileCheck2 /> Document</button> : null}
        {data.capabilities.prepare_offer && ["SELECTED","OFFER_PENDING"].includes(item.status) ? <button type="button" onClick={() => { setDraft({ manager_user_id: reqs.get(item.requisition_id)?.hiring_manager_user_id || data.actor.user_id, currency: "INR", probation_months: "6" }); setModal({ kind: "OFFER", candidate: item }); }}><BriefcaseBusiness /> Offer</button> : null}
      </footer>
      {(data.documents.filter((d) => d.candidate_id === item.id).length > 0) ? <div className={styles.sublist}>{data.documents.filter((d) => d.candidate_id === item.id).map((doc) => <div className={styles.docRow} key={doc.id}><span>{doc.label} · {label(doc.status)}{doc.sha256 ? ` · SHA ${doc.sha256.slice(0, 10)}…` : ""}</span>{data.capabilities.manage_candidates && ["REQUESTED","REJECTED"].includes(doc.status) ? <button type="button" onClick={() => { setDraft({}); setUploadFile(undefined); setModal({ kind: "UPLOAD_DOCUMENT", document: doc }); }}><Upload /> Upload</button> : null}</div>)}</div> : null}
    </article>)}{!filteredCandidates.length ? <div className={styles.empty}><Users /><b>No candidates in scope</b><span>Create candidates only against approved open requisitions.</span></div> : null}</div> : null}

    {view === "interviews" ? <div className={styles.grid}>{data.interviews.map((item) => <article key={item.id} className={styles.card}>
      <header><div><code>{item.stage_code}</code><h3>{item.title}</h3><span>{candidates.get(item.candidate_id)?.full_name || "Candidate"} · {person(item.interviewer_user_id)}</span></div><em data-status={item.status}>{label(item.status)}</em></header>
      <p>{date(item.scheduled_start)}{item.location_or_link ? ` · ${item.location_or_link}` : ""}</p>
      <footer>{data.capabilities.manage_interviews && item.status !== "CANCELLED" ? <button type="button" onClick={() => { setDraft({ outcome: "YES" }); setModal({ kind: "FEEDBACK", interview: item }); }}><ShieldCheck /> Feedback</button> : null}</footer>
      {data.feedback.filter((f) => f.interview_id === item.id).map((f) => <div key={f.id} className={styles.feedback}><b>{label(f.outcome)}</b><span>{f.evidence_note}</span></div>)}
    </article>)}{!data.interviews.length ? <div className={styles.empty}><CalendarDays /><b>No interviews scheduled</b><span>Interview evidence appears here after scheduling.</span></div> : null}</div> : null}

    {view === "offers" ? <div className={styles.grid}>{data.offers.map((item) => <article key={item.id} className={styles.card}>
      <header><div><code>{item.offer_code}</code><h3>{candidates.get(item.candidate_id)?.full_name || item.position_code}</h3><span>{item.position_code} · joins {item.joining_date}</span></div><em data-status={item.status}>{label(item.status)}</em></header>
      <dl><div><dt>Annual CTC</dt><dd>{money(item.annual_ctc_minor,item.currency)}</dd></div><div><dt>Monthly gross</dt><dd>{money(item.monthly_gross_minor,item.currency)}</dd></div><div><dt>Manager</dt><dd>{person(item.reporting_manager_user_id)}</dd></div></dl>
      <footer>{data.capabilities.prepare_offer && item.status === "DRAFT" ? <button type="button" onClick={() => action({ action: "SUBMIT_OFFER", offer_id: item.id }, "Offer routed for independent approval.")}><Send /> Submit</button> : null}{item.approval_request_id ? <button type="button" onClick={() => action({ action: "SYNC_OFFER", offer_id: item.id }, "Offer approval status synchronized.")}><RefreshCw /> Sync</button> : null}{data.capabilities.prepare_offer && item.status === "APPROVED" && !item.offer_document_instance_id ? <button type="button" onClick={() => action({ action: "CREATE_OFFER_DOCUMENT", offer_id: item.id }, "Offer document instance created from the published HR_OFFER template and approved offer snapshot.")}><FileCheck2 /> Generate letter</button> : null}{item.offer_document_instance_id ? <a href="/office/documents"><FileCheck2 /> Document Studio</a> : null}{data.capabilities.manage_onboarding && ["DOCUMENT_READY","OFFERED"].includes(item.status) ? <button type="button" onClick={() => { setDraft({}); setModal({ kind: "ACCEPT", offer: item }); }}><CheckCircle2 /> Record acceptance</button> : null}</footer>
    </article>)}{!data.offers.length ? <div className={styles.empty}><BriefcaseBusiness /><b>No offer proposals</b><span>Offers are created only after a candidate reaches Selected.</span></div> : null}</div> : null}

    {modal ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
      <header><div><p>CONTROLLED PEOPLE WORKFLOW</p><h3>{modal.kind === "REQUISITION" ? "Create hiring requisition" : modal.kind === "CANDIDATE" ? "Add candidate" : modal.kind === "TRANSITION" ? "Change candidate stage" : modal.kind === "INTERVIEW" ? "Schedule interview" : modal.kind === "FEEDBACK" ? "Record interview feedback" : modal.kind === "DOCUMENT" ? "Request candidate document" : modal.kind === "UPLOAD_DOCUMENT" ? "Upload candidate evidence" : modal.kind === "OFFER" ? "Prepare offer proposal" : "Record offer acceptance"}</h3></div><button type="button" onClick={() => setModal(undefined)}><X /></button></header>
      {modal.kind === "REQUISITION" ? <>
        <div className={styles.two}><label>Position<select value={draft.position || ""} onChange={(e) => { const pos=data.positions.find((p)=>p.code===e.target.value); setDraft({ ...draft, position:e.target.value, department:pos?.department_code || draft.department }); }}>{data.positions.map((p)=><option key={p.code} value={p.code}>{p.label}</option>)}</select></label><label>Department<select value={draft.department || ""} onChange={(e)=>setDraft({...draft,department:e.target.value})}>{data.departments.map((d)=><option key={d.code} value={d.code}>{d.label}</option>)}</select></label></div>
        <label>Hiring manager<select value={draft.manager_user_id || ""} onChange={(e)=>setDraft({...draft,manager_user_id:e.target.value})}>{data.identities.map((p)=><option key={p.user_id} value={p.user_id}>{p.display_name || p.job_title || p.user_id}</option>)}</select></label>
        <div className={styles.three}><label>Openings<input type="number" min="1" value={draft.openings || "1"} onChange={(e)=>setDraft({...draft,openings:e.target.value})} /></label><label>Employment<select value={draft.employment_type || "EMPLOYEE"} onChange={(e)=>setDraft({...draft,employment_type:e.target.value})}>{["EMPLOYEE","CONTRACTOR","INTERN","TRAINEE","PROFESSIONAL"].map(v=><option key={v}>{v}</option>)}</select></label><label>Work mode<select value={draft.work_mode || "OFFICE"} onChange={(e)=>setDraft({...draft,work_mode:e.target.value})}>{["OFFICE","REMOTE","HYBRID","FIELD"].map(v=><option key={v}>{v}</option>)}</select></label></div>
        <label>Location<input value={draft.location || ""} onChange={(e)=>setDraft({...draft,location:e.target.value})} /></label>
        <div className={styles.three}><label>Budget min<input inputMode="decimal" value={draft.budget_min || ""} onChange={(e)=>setDraft({...draft,budget_min:e.target.value})} /></label><label>Budget max<input inputMode="decimal" value={draft.budget_max || ""} onChange={(e)=>setDraft({...draft,budget_max:e.target.value})} /></label><label>Currency<input value={draft.currency || "INR"} maxLength={3} onChange={(e)=>setDraft({...draft,currency:e.target.value.toUpperCase()})} /></label></div>
        <label>Business reason<textarea required minLength={3} value={draft.reason || ""} onChange={(e)=>setDraft({...draft,reason:e.target.value})} /></label>
      </> : modal.kind === "CANDIDATE" ? <>
        <label>Requisition<select required value={draft.requisition_id || ""} onChange={(e)=>setDraft({...draft,requisition_id:e.target.value})}>{data.requisitions.filter(r=>r.status==="OPEN").map(r=><option key={r.id} value={r.id}>{r.requisition_code} · {r.position_code}</option>)}</select></label>
        <label>Full name<input required value={draft.name || ""} onChange={(e)=>setDraft({...draft,name:e.target.value})} /></label><div className={styles.two}><label>Email<input type="email" required value={draft.email || ""} onChange={(e)=>setDraft({...draft,email:e.target.value})} /></label><label>Phone<input value={draft.phone || ""} onChange={(e)=>setDraft({...draft,phone:e.target.value})} /></label></div>
        <div className={styles.two}><label>Location<input value={draft.location || ""} onChange={(e)=>setDraft({...draft,location:e.target.value})} /></label><label>Source<input value={draft.source_channel || "DIRECT"} onChange={(e)=>setDraft({...draft,source_channel:e.target.value.toUpperCase()})} /></label></div><label>Source reference<input value={draft.source_reference || ""} onChange={(e)=>setDraft({...draft,source_reference:e.target.value})} /></label>
      </> : modal.kind === "TRANSITION" ? <><label>Stage<select value={draft.status || modal.candidate.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}>{["APPLIED","SCREENING","INTERVIEW","SELECTED","OFFER_PENDING","OFFERED","ACCEPTED","DECLINED","REJECTED","WITHDRAWN","ONBOARDING","HIRED"].map(v=><option key={v}>{v}</option>)}</select></label><label>Evidence note<textarea value={draft.note || ""} onChange={(e)=>setDraft({...draft,note:e.target.value})} /></label></>
      : modal.kind === "INTERVIEW" ? <><div className={styles.two}><label>Stage<input required value={draft.stage || ""} onChange={(e)=>setDraft({...draft,stage:e.target.value.toUpperCase()})} /></label><label>Interviewer<select value={draft.interviewer_user_id || ""} onChange={(e)=>setDraft({...draft,interviewer_user_id:e.target.value})}>{data.identities.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name || p.job_title || p.user_id}</option>)}</select></label></div><label>Title<input required value={draft.title || ""} onChange={(e)=>setDraft({...draft,title:e.target.value})} /></label><div className={styles.two}><label>Starts<input type="datetime-local" required value={draft.starts_at || ""} onChange={(e)=>setDraft({...draft,starts_at:e.target.value})} /></label><label>Ends<input type="datetime-local" value={draft.ends_at || ""} onChange={(e)=>setDraft({...draft,ends_at:e.target.value})} /></label></div><label>Location / meeting link<input value={draft.location || ""} onChange={(e)=>setDraft({...draft,location:e.target.value})} /></label></>
      : modal.kind === "FEEDBACK" ? <><label>Outcome<select value={draft.outcome || "YES"} onChange={(e)=>setDraft({...draft,outcome:e.target.value})}>{["STRONG_YES","YES","MIXED","NO","STRONG_NO"].map(v=><option key={v}>{v}</option>)}</select></label><label>Evidence<textarea required minLength={3} value={draft.evidence || ""} onChange={(e)=>setDraft({...draft,evidence:e.target.value})} /></label><div className={styles.two}><label>Strengths<textarea value={draft.strengths || ""} onChange={(e)=>setDraft({...draft,strengths:e.target.value})} /></label><label>Concerns<textarea value={draft.concerns || ""} onChange={(e)=>setDraft({...draft,concerns:e.target.value})} /></label></div></>
      : modal.kind === "DOCUMENT" ? <><label>Document type<input required value={draft.document_type || ""} onChange={(e)=>setDraft({...draft,document_type:e.target.value.toUpperCase()})} placeholder="PAN / AADHAAR / DEGREE / EXPERIENCE" /></label><label>Label<input required value={draft.label || ""} onChange={(e)=>setDraft({...draft,label:e.target.value})} /></label><label className={styles.check}><input type="checkbox" checked={draft.required !== "false"} onChange={(e)=>setDraft({...draft,required:e.target.checked ? "true" : "false"})} /> Required before onboarding</label></>
      : modal.kind === "UPLOAD_DOCUMENT" ? <><p className={styles.warning}>Files are stored only in KRAVIA&apos;s private candidate vault. The server verifies the file signature, MIME type, size and SHA-256 before committing evidence.</p><label>Requested document<input value={modal.document.label} disabled /></label><label>File<input type="file" required accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e)=>setUploadFile(e.target.files?.[0])} /></label><label>Source / verification reference<input value={draft.source_reference || ""} onChange={(e)=>setDraft({...draft,source_reference:e.target.value})} placeholder="Optional issuer, portal or verification reference" /></label></>
      : modal.kind === "OFFER" ? <><label>Reporting manager<select value={draft.manager_user_id || ""} onChange={(e)=>setDraft({...draft,manager_user_id:e.target.value})}>{data.identities.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name || p.job_title || p.user_id}</option>)}</select></label><div className={styles.two}><label>Joining date<input type="date" required value={draft.joining_date || ""} onChange={(e)=>setDraft({...draft,joining_date:e.target.value})} /></label><label>Grade<input value={draft.grade || ""} onChange={(e)=>setDraft({...draft,grade:e.target.value})} /></label></div><div className={styles.three}><label>Annual CTC<input required inputMode="decimal" value={draft.annual_ctc || ""} onChange={(e)=>setDraft({...draft,annual_ctc:e.target.value})} /></label><label>Monthly gross<input required inputMode="decimal" value={draft.monthly_gross || ""} onChange={(e)=>setDraft({...draft,monthly_gross:e.target.value})} /></label><label>Currency<input value={draft.currency || "INR"} maxLength={3} onChange={(e)=>setDraft({...draft,currency:e.target.value.toUpperCase()})} /></label></div><div className={styles.two}><label>Probation months<input type="number" min="0" max="36" value={draft.probation_months || ""} onChange={(e)=>setDraft({...draft,probation_months:e.target.value})} /></label><label>Offer valid until<input type="datetime-local" value={draft.valid_until || ""} onChange={(e)=>setDraft({...draft,valid_until:e.target.value})} /></label></div><label>Variable pay note<textarea value={draft.variable_pay_note || ""} onChange={(e)=>setDraft({...draft,variable_pay_note:e.target.value})} /></label><label>Special approved condition<textarea value={draft.special_condition_note || ""} onChange={(e)=>setDraft({...draft,special_condition_note:e.target.value})} /></label></>
      : <label>Acceptance evidence reference<input required minLength={3} value={draft.evidence_reference || ""} onChange={(e)=>setDraft({...draft,evidence_reference:e.target.value})} placeholder="Signed document / eSign / secure acceptance reference" /></label>}
      <footer><button type="button" onClick={()=>setModal(undefined)} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Confirm</button></footer>
    </form></div> : null}
  </section>;
}
