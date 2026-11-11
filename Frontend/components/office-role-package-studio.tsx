"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, BriefcaseBusiness, CalendarDays, CheckCheck, CircleAlert,
  ClipboardList, FileText, Layers, LoaderCircle, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import styles from "./office-role-package-studio.module.css";

type Person = {
  user_id: string; display_name?: string | null; job_title?: string | null;
  primary_department?: string | null; status: string;
};
type Position = { code: string; label: string; family: string; level: number; is_manager: boolean };
type Department = { code: string; label: string };
type Profile = { code: string; label: string; category: string; description: string; owner_managed_only: boolean; assignable_by_admin: boolean };
type ProfileGrant = { profile_code: string; scope_type: "DEPARTMENT" | "COMPANY" | "TEAM" | "PRODUCT" | "PROJECT" | "REPOSITORY" | "COST_CENTER" | "OWN"; scope_key?: string };
type ExtraRole = { position_code: string; department_code: string; responsibilities?: string[] };
type Step = { code: string; label: string; required: boolean };
type WorkPattern = { days: string[]; daily_minutes: number; weekly_minutes: number; flexible: boolean; time_zone: "Asia/Kolkata" };
type Template = {
  id: string; code: string; version: number; label: string; description: string;
  department_code: string; primary_position_code: string; employment_type: string;
  responsibilities: string[]; additional_roles: ExtraRole[]; access_profiles: ProfileGrant[];
  onboarding_steps: Step[]; work_pattern: WorkPattern; status: string;
};
type Application = {
  id: string; package_id: string; employee_user_id: string; applied_at: string;
  reason: string; snapshot: {
    code: string; version: number; label: string; department_code: string; primary_position_code: string;
    responsibilities: string[]; additional_roles: ExtraRole[]; access_profiles: ProfileGrant[];
    onboarding_steps: Step[]; work_pattern: WorkPattern;
  };
};
type Task = {
  id: string; application_id: string; task_code: string; label: string;
  required: boolean; status: "PENDING" | "SUBMITTED" | "VERIFIED" | "WAIVED";
  evidence_reference?: string | null; review_note?: string | null;
};
type Functional = { position_code: string; department_code: string; application_id: string; responsibilities: string[] };
type State = {
  actor: { user_id: string; can_manage: boolean; is_founder?: boolean };
  employee: Person; applications: Application[]; tasks: Task[]; functional_positions: Functional[];
  people: Person[]; templates: Template[]; positions: Position[]; departments: Department[]; access_profiles: Profile[];
  notice: string;
};
const standardSteps: Step[] = [
  { code: "IDENTITY_VERIFIED", label: "Verify official identity and employee details", required: true },
  { code: "APPOINTMENT_SIGNED", label: "Attach genuinely signed appointment letter", required: true },
  { code: "POLICIES_ACKNOWLEDGED", label: "Acknowledge company and information-security policies", required: true },
  { code: "BANK_DETAILS_REVIEWED", label: "Verify salary bank account with Finance", required: true },
  { code: "SCOPE_DEVICE_REVIEW", label: "Review assigned permissions and approved device", required: true },
  { code: "WORKTIME_ACKNOWLEDGED", label: "Acknowledge flexible worktime and overtime policy", required: true },
];
const defaultPattern: WorkPattern = {
  days: ["MON","TUE","WED","THU","FRI"], daily_minutes: 360, weekly_minutes: 1800,
  flexible: true, time_zone: "Asia/Kolkata",
};
const employmentOptions = ["EMPLOYEE","CONTRACTOR","INTERN","TRAINEE","ADVISOR","PROFESSIONAL"] as const;
const scopeOptions = ["DEPARTMENT","PROJECT","REPOSITORY","TEAM","PRODUCT","COST_CENTER","OWN","COMPANY"] as const;
const weekdayCodes = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

async function api<T>(body?: Record<string, unknown>, employee?: string): Promise<T> {
  const url = "/api/office-role-packages" + (!body && employee ? "?employee=" + encodeURIComponent(employee) : "");
  const response = await fetch(url, {
    method: body ? "POST" : "GET", credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined, cache: "no-store",
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof value.detail === "string" ? value.detail : "Office role packages are unavailable");
  return value as T;
}
function hours(minutes: number) { return (minutes / 60).toFixed(1).replace(/\.0$/,"") + " h"; }
function heading(template: Template) { return template.code + " · v" + template.version; }

export function OfficeRolePackageStudio({ view = "admin" }: { view?: "admin" | "self" }) {
  const [state, setState] = useState<State>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    code: "", label: "", description: "", department: "", position: "",
    employmentType: "EMPLOYEE", responsibilities: "",
  });
  const [grants, setGrants] = useState<ProfileGrant[]>([]);
  const [grantDraft, setGrantDraft] = useState<{ profile_code: string; scope_type: ProfileGrant["scope_type"]; scope_key: string }>({
    profile_code: "", scope_type: "DEPARTMENT", scope_key: "",
  });
  const [extraRoles, setExtraRoles] = useState<ExtraRole[]>([]);
  const [extraDraft, setExtraDraft] = useState({ position_code: "", department_code: "" });
  const [steps, setSteps] = useState<Step[]>(standardSteps);
  const [stepDraft, setStepDraft] = useState({ code: "", label: "", required: true });
  const [pattern, setPattern] = useState<WorkPattern>(defaultPattern);
  const [targetId, setTargetId] = useState("");
  const [applyTemplate, setApplyTemplate] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void api<State>().then(data => { if (alive) setState(data); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Office role service unavailable"); });
    return () => { alive = false; };
  }, []);

  async function reload(employee = selected, message?: string) {
    const result = await api<State>(undefined, employee || undefined);
    setState(result);
    if (message) setNotice(message);
  }
  async function mutate(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(body);
      await reload(selected, success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role-package operation failed");
      return false;
    } finally { setBusy(false); }
  }
  const admin = view === "admin" && state?.actor.can_manage === true;
  const active = useMemo(() => (state?.templates ?? []).filter(t => t.status === "ACTIVE"), [state?.templates]);
  const applicationTasks = (application: Application) =>
    (state?.tasks ?? []).filter(task => task.application_id === application.id);
  const completed = (tasks: Task[]) =>
    tasks.length ? tasks.filter(t => t.status === "VERIFIED" || t.status === "WAIVED").length : 0;

  function addProfile() {
    if (!grantDraft.profile_code) return;
    const scope = grantDraft.scope_type;
    const key = scope === "COMPANY" || scope === "OWN" ? undefined : grantDraft.scope_key.trim();
    if (scope !== "COMPANY" && scope !== "OWN" && !key) { setError("Select a scoped department or enter a resource key"); return; }
    const next = { profile_code: grantDraft.profile_code, scope_type: scope, scope_key: key };
    if (!grants.some(g => g.profile_code === next.profile_code &&
      g.scope_type === next.scope_type && g.scope_key === next.scope_key)) setGrants(g => [...g, next]);
  }
  function addExtraRole() {
    if (!extraDraft.department_code || !extraDraft.position_code) return;
    if (!extraRoles.some(x => x.department_code === extraDraft.department_code && x.position_code === extraDraft.position_code)) {
      setExtraRoles(v => [...v, { ...extraDraft, responsibilities: [] }]);
    }
  }
  function addStep() {
    const code = stepDraft.code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "_");
    if (!/^[A-Z][A-Z0-9_]{2,59}$/.test(code) || stepDraft.label.trim().length < 3) {
      setError("Checklist items need a valid unique code and descriptive label"); return;
    }
    if (!steps.some(s => s.code === code)) setSteps(v => [...v, { code, label: stepDraft.label.trim(), required: stepDraft.required }]);
    setStepDraft({ code: "", label: "", required: true });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await mutate({ action: "CREATE", draft: {
      code: draft.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      label: draft.label.trim(), description: draft.description.trim(),
      department: draft.department, position: draft.position,
      employmentType: draft.employmentType,
      responsibilities: draft.responsibilities.split("\n").map(s => s.trim()).filter(Boolean),
      additionalRoles: extraRoles, profiles: grants, steps, workPattern: pattern,
    } }, "Versioned role package saved as draft. No employee or permission was changed.");
    if (ok) { setCreateOpen(false); setDraft({ code: "", label: "", description: "", department: "", position: "", employmentType: "EMPLOYEE", responsibilities: "" }); }
  }
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await mutate({ action: "APPLY", packageId: applyTemplate, employeeId: targetId, reason },
      "Reusable package applied atomically through the canonical job and access-profile controls. Salary and department ownership remain separate.");
    if (ok) { setApplyTemplate(""); setReason(""); setTargetId(""); }
  }
  async function review(task: Task, decision: "SUBMIT" | "VERIFY" | "RETURN" | "WAIVE") {
    const success = await mutate({
      action: "TASK", taskId: task.id, decision,
      reference: decision === "SUBMIT" ? evidence[task.id]?.trim() : undefined,
      note: decision !== "SUBMIT" ? reviewNotes[task.id]?.trim() : undefined,
    }, decision === "SUBMIT" ? "Evidence submitted for independent review." : "Onboarding task updated with an audit entry.");
    if (success) { setEvidence(x => ({ ...x, [task.id]: "" })); setReviewNotes(x => ({ ...x, [task.id]: "" })); }
  }

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>KRAVIA OFFICE · REUSABLE WORKFORCE</span>
        <h2>{view === "admin" ? "Universal role & onboarding packages" : "My roles & onboarding"}</h2>
        <p>One configuration for every department and future hire. Primary position, additional duties, permissions, work pattern and verified onboarding stay linked but independently controlled.</p>
      </div>
      {admin ? <button type="button" onClick={() => setCreateOpen(v => !v)} disabled={busy}>
        {createOpen ? <X size={16}/> : <Plus size={16}/>} {createOpen ? "Close builder" : "Create reusable package"}
      </button> : null}
    </header>
    {error ? <div className={styles.error}><CircleAlert size={18}/>{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div> : null}
    {notice ? <div className={styles.success}><ShieldCheck size={18}/>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16}/></button></div> : null}
    {!state ? <div className={styles.loading}><LoaderCircle size={20}/>Loading canonical workforce catalogues…</div> :
    <>
      {admin ? <div className={styles.metrics}>
        <article><Layers/><strong>{state.templates.length}</strong><small>Versioned packages</small></article>
        <article><BriefcaseBusiness/><strong>{state.positions.length}</strong><small>Canonical positions</small></article>
        <article><ShieldCheck/><strong>{state.access_profiles.length}</strong><small>Reusable access profiles</small></article>
        <article><Users/><strong>{state.people.length}</strong><small>Office identities</small></article>
      </div> : null}

      {admin && createOpen ? <form className={styles.builder} onSubmit={create}>
        <div className={styles.sectionHeader}><div><h3>Create the package once</h3><p>Use existing catalogue entries. Saving creates an inactive draft; publishing never assigns an employee.</p></div></div>
        <div className={styles.fields}>
          <label>Reusable code<input required maxLength={60} minLength={3} placeholder="FULLSTACK_PRODUCT_TEAM" value={draft.code} onChange={e => setDraft(d => ({ ...d, code: e.target.value }))}/></label>
          <label>Display name<input required minLength={3} maxLength={140} placeholder="Full-stack engineering contributor" value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}/></label>
          <label>Primary department<select required value={draft.department} onChange={e => {
            const dept = e.target.value;
            setDraft(d => ({ ...d, department: dept }));
            setGrantDraft(g => ({ ...g, scope_key: dept }));
          }}><option value="">Select department</option>{state.departments.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}</select></label>
          <label>Primary position<select required value={draft.position} onChange={e => setDraft(d => ({ ...d, position: e.target.value }))}><option value="">Select position</option>{state.positions.map(p => <option key={p.code} value={p.code}>{p.label} · {p.family}</option>)}</select></label>
          <label>Employment relationship<select value={draft.employmentType} onChange={e => setDraft(d => ({ ...d, employmentType: e.target.value }))}>{employmentOptions.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className={styles.full}>Description<textarea maxLength={2000} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}/></label>
          <label className={styles.full}>Responsibilities <small>One per line, each applicable to the position</small>
            <textarea minLength={3} required value={draft.responsibilities} placeholder={"Own assigned work\nMaintain implementation and security standards\nRecord delivery evidence"} onChange={e => setDraft(d => ({ ...d, responsibilities: e.target.value }))}/></label>
        </div>

        <div className={styles.subsection}><h4>Additional functional positions</h4>
          <p>These record additional duties. They never confer permissions or department ownership by themselves.</p>
          <div className={styles.inlineFields}><select aria-label="Additional department" value={extraDraft.department_code} onChange={e => setExtraDraft(d => ({ ...d, department_code: e.target.value }))}>
            <option value="">Department</option>{state.departments.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}</select>
            <select aria-label="Additional position" value={extraDraft.position_code} onChange={e => setExtraDraft(d => ({ ...d, position_code: e.target.value }))}>
              <option value="">Position</option>{state.positions.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}</select>
            <button type="button" disabled={!extraDraft.position_code || !extraDraft.department_code} onClick={addExtraRole}><Plus size={15}/>Add duty</button></div>
          <div className={styles.tokens}>{extraRoles.map(x => <span key={x.department_code+x.position_code}>{x.department_code} · {x.position_code}<button type="button" onClick={() => setExtraRoles(items => items.filter(v => v!==x))} aria-label="Remove functional role"><X size={14}/></button></span>)}</div>
        </div>

        <div className={styles.subsection}><h4>Scoped access profiles</h4>
          <p>No temporary access, hidden Owner elevation or automatically granted system roles. Explicitly assign each existing profile with a resource scope.</p>
          <div className={styles.inlineFields}>
            <select aria-label="Access profile" value={grantDraft.profile_code} onChange={e => setGrantDraft(g => ({ ...g, profile_code: e.target.value }))}>
              <option value="">Select existing profile</option>{state.access_profiles.filter(p => state.actor.is_founder || (!p.owner_managed_only && p.assignable_by_admin)).map(p => <option key={p.code} value={p.code}>{p.label} · {p.category}</option>)}</select>
            <select aria-label="Scope" value={grantDraft.scope_type} onChange={e => setGrantDraft(g => ({ ...g, scope_type: e.target.value as ProfileGrant["scope_type"] }))}>
              {scopeOptions.map(s => <option key={s} value={s}>{s}</option>)}</select>
            {grantDraft.scope_type !== "COMPANY" && grantDraft.scope_type !== "OWN" ?
              grantDraft.scope_type === "DEPARTMENT" ? <select aria-label="Scoped department" value={grantDraft.scope_key} onChange={e => setGrantDraft(g => ({ ...g, scope_key: e.target.value }))}>
                <option value="">Choose department</option>{state.departments.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}</select> :
              <input aria-label="Resource scope key" value={grantDraft.scope_key} onChange={e => setGrantDraft(g => ({ ...g, scope_key: e.target.value }))} placeholder="Project / repository key"/> : null}
            <button type="button" onClick={addProfile} disabled={!grantDraft.profile_code}><Plus size={15}/>Add access</button>
          </div>
          {grantDraft.scope_type === "COMPANY" ? <p className={styles.warning}>Company-wide profiles can grant broad access; only Founder may create them. Prefer department or project scope.</p> : null}
          <div className={styles.tokens}>{grants.map((g,i) => <span key={i}>{g.profile_code} · {g.scope_type}{g.scope_key ? " / "+g.scope_key : ""}
            <button type="button" onClick={() => setGrants(v => v.filter((_,j) => i!==j))} aria-label="Remove access"><X size={14}/></button></span>)}</div>
        </div>

        <div className={styles.subsection}><h4>Work schedule reference</h4>
          <p>Scheduling metadata only. Compensation and premium rules require their own approved payroll policy.</p>
          <div className={styles.inlineFields}>
            <label>Daily working hours<input type="number" min={1} max={10} step={0.5} value={pattern.daily_minutes/60} onChange={e => setPattern(p => ({ ...p, daily_minutes: Math.round(Number(e.target.value)*60) }))}/></label>
            <label>Weekly working hours<input type="number" min={1} max={48} step={0.5} value={pattern.weekly_minutes/60} onChange={e => setPattern(p => ({ ...p, weekly_minutes: Math.round(Number(e.target.value)*60) }))}/></label>
            <label className={styles.check}><input type="checkbox" checked={pattern.flexible} onChange={e => setPattern(p => ({ ...p, flexible: e.target.checked }))}/> Flexible starting times</label>
          </div>
          <div className={styles.days}>{weekdayCodes.map(day => <label key={day}><input type="checkbox" checked={pattern.days.includes(day)} onChange={e => setPattern(p => ({ ...p, days: e.target.checked ? [...p.days,day] : p.days.filter(x => x!==day) }))}/>{day}</label>)}</div>
        </div>

        <div className={styles.subsection}><h4>Reusable onboarding checklist</h4>
          <p>Checklists record actual documents and reviews; an item is never marked verified just because a package was applied.</p>
          <div className={styles.steps}>{steps.map(s => <div key={s.code}><span><b>{s.label}</b><small>{s.code} · {s.required ? "Required" : "Optional"}</small></span>
            <button type="button" onClick={() => setSteps(v => v.filter(x => x.code!==s.code))} aria-label={"Remove "+s.label}><Trash2 size={15}/></button></div>)}</div>
          <div className={styles.inlineFields}>
            <input aria-label="Checklist code" value={stepDraft.code} placeholder="STEP_CODE" onChange={e => setStepDraft(s => ({ ...s, code: e.target.value }))}/>
            <input aria-label="Checklist label" value={stepDraft.label} placeholder="Verification or acknowledgement" onChange={e => setStepDraft(s => ({ ...s, label: e.target.value }))}/>
            <label className={styles.check}><input type="checkbox" checked={stepDraft.required} onChange={e => setStepDraft(s => ({ ...s, required: e.target.checked }))}/>Required</label>
            <button type="button" onClick={addStep}><Plus size={15}/>Add checklist step</button>
          </div>
        </div>
        <button className={styles.primary} disabled={busy || !draft.department || !draft.position} type="submit">
          {busy ? <LoaderCircle size={16}/> : <CheckCheck size={16}/>} Save new draft version
        </button>
      </form> : null}

      {admin ? <div className={styles.panels}>
        <article className={styles.panel}>
          <div className={styles.sectionHeader}><h3><Layers size={18}/>Published role packages</h3><small>{active.length} reusable</small></div>
          {state.templates.length ? state.templates.map(t => <div className={styles.record} key={t.id}>
            <div><strong>{t.label}</strong><small>{heading(t)} · {t.department_code} · {t.primary_position_code}</small>
              <small>{t.access_profiles?.length ?? 0} scoped profiles · {t.additional_roles?.length ?? 0} additional roles · {t.onboarding_steps?.length ?? 0} onboarding steps</small></div>
            <div className={styles.actions}><span data-status={t.status}>{t.status}</span>
              {t.status === "DRAFT" ? <button type="button" disabled={busy} onClick={() => void mutate({ action:"PUBLISH",packageId:t.id },"Published reusable package; no employee changed.")}>Publish</button> :
                t.status === "ACTIVE" ? <button type="button" disabled={busy} onClick={() => {setApplyTemplate(t.id);setReason("");}}>Assign</button> : null}
            </div></div>) : <p className={styles.empty}>No reusable packages yet. Create one from your existing departments, positions and access profiles.</p>}
        </article>
        <article className={styles.panel}>
          <div className={styles.sectionHeader}><h3><Users size={18}/>Assign to verified employee</h3></div>
          <p>Same published package works for any employee. Existing canonical approvals, trusted identities and scopes are enforced.</p>
          <form className={styles.inlineForm} onSubmit={apply}>
            <label>Published package<select required value={applyTemplate} onChange={e => setApplyTemplate(e.target.value)}>
              <option value="">Select reusable package</option>{active.map(t => <option key={t.id} value={t.id}>{t.label} · v{t.version}</option>)}</select></label>
            <label>Recipient<select required value={targetId} onChange={e => setTargetId(e.target.value)}>
              <option value="">Select verified active employee</option>{state.people.filter(p => p.status==="ACTIVE" && p.user_id!==state.actor.user_id).map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id}</option>)}</select></label>
            <label>Assignment reason<textarea required minLength={12} value={reason} placeholder="Transfer defined project responsibilities and department-scoped access" onChange={e => setReason(e.target.value)}/></label>
            <button className={styles.primary} disabled={!applyTemplate || !targetId || busy || reason.trim().length<12} type="submit">
              {busy ? <LoaderCircle size={16}/> : <CheckCheck size={16}/>} Apply package to employee
            </button>
          </form>
        </article>
      </div> : null}

      <article className={styles.panel}>
        <div className={styles.sectionHeader}><h3><ClipboardList size={18}/>Employee roles & onboarding</h3>
          {admin ? <label className={styles.employeeSelect}>Employee<select value={selected} onChange={e => {
            const next=e.target.value;setSelected(next);setError("");
            void api<State>(undefined,next||undefined).then(setState)
              .catch((ex: unknown) => setError(ex instanceof Error ? ex.message : "Employee record unavailable"));
          }}><option value="">My profile</option>{state.people.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id}</option>)}</select></label> : null}
        </div>
        <div className={styles.person}><div className={styles.avatar}>{(state.employee.display_name || "KR").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div>
          <div><strong>{state.employee.display_name || "Office employee"}</strong><small>{state.employee.job_title || "No primary job assigned"} · {state.employee.primary_department || "Unassigned"}</small></div></div>
        {state.applications.length ? state.applications.map(application => {
          const items=applicationTasks(application);
          return <div className={styles.application} key={application.id}>
            <div className={styles.sectionHeader}><div><h4>{application.snapshot.label}</h4>
              <small>{application.snapshot.code} · v{application.snapshot.version} · {application.snapshot.department_code}</small></div>
              <span>{completed(items)}/{items.length} onboarding reviews</span></div>
            <div className={styles.smallGrid}>
              <div><b>Primary role</b><small>{application.snapshot.primary_position_code}</small></div>
              <div><b>Additional duties</b><small>{application.snapshot.additional_roles?.map(x=>x.position_code).join(", ") || "None"}</small></div>
              <div><b>Scoped access</b><small>{application.snapshot.access_profiles?.length || 0} profile(s)</small></div>
              <div><b>Working pattern</b><small>{hours(application.snapshot.work_pattern.daily_minutes)} daily · {hours(application.snapshot.work_pattern.weekly_minutes)} weekly</small></div>
            </div>
            <div className={styles.duties}><h5>Responsibilities</h5>{application.snapshot.responsibilities?.length ? <ul>{application.snapshot.responsibilities.map((line,i)=><li key={i}>{line}</li>)}</ul> : <p>No responsibilities supplied in this package.</p>}</div>
            {items.length ? <div className={styles.steps}>{items.map(task => <div className={styles.task} key={task.id}>
              <div><b>{task.label}</b><small>{task.required?"Required":"Optional"} · {task.status}{task.evidence_reference ? " · Evidence recorded" : ""}</small>
                {task.review_note ? <small>Review: {task.review_note}</small> : null}</div>
              <div className={styles.taskAction}>
                {task.status==="PENDING" || task.status==="SUBMITTED" ? task.status!=="SUBMITTED" || application.employee_user_id===state.actor.user_id ?
                  <><input aria-label={"Evidence for "+task.label} placeholder="Verified document or record reference" value={evidence[task.id] || ""} onChange={e=>setEvidence(x=>({...x,[task.id]:e.target.value}))}/>
                    {application.employee_user_id===state.actor.user_id ? <button type="button" disabled={busy || (evidence[task.id]||"").trim().length<8} onClick={()=>void review(task,"SUBMIT")}>Submit</button> : null}</> : null : null}
                {admin && application.employee_user_id!==state.actor.user_id && task.status==="SUBMITTED" ? <><input aria-label={"Review note for "+task.label} placeholder="Optional reviewer note" value={reviewNotes[task.id] || ""} onChange={e=>setReviewNotes(x=>({...x,[task.id]:e.target.value}))}/>
                  <button type="button" disabled={busy} onClick={()=>void review(task,"VERIFY")}>Verify</button><button type="button" disabled={busy} onClick={()=>void review(task,"RETURN")}>Return</button></> : null}
              </div></div>)}</div> : null}
          </div>;
        }) : <p className={styles.empty}>No role package assigned yet. An authorised director can apply a published package without generating fictitious employment or payroll records.</p>}
        <div className={styles.references}>
          <a href="/office/recruitment"><BookOpen size={15}/>Recruitment</a>
          <a href="/office/documents"><FileText size={15}/>Appointment & documents</a>
          <a href="/office/worktime"><CalendarDays size={15}/>Attendance & payslips</a>
        </div>
      </article>
      <p className={styles.disclaimer}>{state.notice}</p>
    </>}
  </section>;
}
