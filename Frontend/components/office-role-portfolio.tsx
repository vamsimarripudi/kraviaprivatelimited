"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowRightLeft, BadgeCheck, BookOpen, CheckCircle2, ChevronRight,
  ClipboardList, FileCheck2, KeyRound, Layers3, LockKeyhole, LoaderCircle,
  Plus, RefreshCw, Send, Shield, ShieldAlert, ShieldCheck, UserRound, UsersRound, X,
} from "lucide-react";
import styles from "./office-role-portfolio.module.css";

type Person = { user_id: string; display_name: string; job_title?: string | null; primary_department?: string | null };
type Position = { code: string; label: string; family: string; level: number; is_manager: boolean };
type Department = { code: string; label: string };
type Seat = {
  id: string; seat_code: string; label: string; position_code: string;
  department_code: string; description: string; responsibilities: string[];
  current_holder_user_id: string | null; status: string; department_ownership_required: boolean; version: number;
};
type Handover = {
  id: string; seat_id: string; from_user_id?: string | null; to_user_id: string;
  proposed_by: string; reason: string; status: string; proposed_at: string;
  accepted_at?: string | null; completed_at?: string | null;
};
type HandoverItem = {
  id: string; transfer_id: string; item_code: string; label: string;
  category: string; required: boolean; status: string; evidence_reference?: string | null;
};
type RoleGrant = {
  id: string; seat_id: string; permission_code: string; scope_type: string;
  scope_key: string | null; exclusive: boolean; status: string; created_by: string;
};
type Employee = Person & {
  primary_job?: { position_code: string; department_code: string; status: string; start_date?: string | null } | null;
  security_roles: string[];
  profiles: Array<{ profile_code: string; status: string; effective_from?: string | null; expires_at?: string | null }>;
};
type State = {
  actor: { user_id: string; display_name: string; roles: string[]; is_owner: boolean; is_reviewer: boolean };
  current_job: { position_code: string; department_code: string; status: string } | null;
  functional_positions: Array<{ position_code: string; department_code: string; responsibilities: string[] }>;
  seats: Seat[]; transfers: Handover[]; items: HandoverItem[]; grants: RoleGrant[];
  people: Person[]; employee_directory: Employee[];
  positions: Position[]; departments: Department[];
  permissions: Array<{ code: string; module: string; action: string; high_risk: boolean; owner_bypass: boolean }>;
  notice: string;
};
type Action =
  | { action: "CREATE"; code: string; label: string; position: string; department: string; description: string; requires_department_handover: boolean }
  | { action: "GRANT"; seat_id: string; permission: string; scope_type: string; scope_key: string | null; exclusive: boolean }
  | { action: "REVIEW_GRANT"; grant_id: string; approve: boolean; reason: string }
  | { action: "PROPOSE"; seat_id: string; recipient_id: string; reason: string }
  | { action: "ACCEPT"; transfer_id: string }
  | { action: "VERIFY_ITEM"; item_id: string; evidence: string }
  | { action: "FINALIZE"; transfer_id: string; evidence: string }
  | { action: "CANCEL"; transfer_id: string; reason: string };

const initialSeat = { code: "", label: "", position: "", department: "", description: "", requires_department_handover: false };
const initialGrant = { permission: "", scope_type: "COMPANY", scope_key: "", exclusive: false };
const scopeTypes = ["COMPANY", "DEPARTMENT", "TEAM", "PRODUCT", "PROJECT", "REPOSITORY", "COST_CENTER", "OWN"];

async function officeJson<T>(input?: Action): Promise<T> {
  const response = await fetch("/api/office-role-seats", {
    method: input ? "POST" : "GET",
    cache: "no-store",
    credentials: "same-origin",
    ...(input ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Unable to reach role portfolio");
  return payload as T;
}
function formatDate(date?: string | null) {
  if (!date) return "—";
  const dt = new Date(date);
  return Number.isNaN(dt.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(dt);
}

export function OfficeRolePortfolio({ focusSeatId }: { focusSeatId?: string }) {
  const [state, setState] = useState<State>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string | null>(focusSeatId ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [seatDraft, setSeatDraft] = useState(initialSeat);
  const [transferDraft, setTransferDraft] = useState({ recipient: "", reason: "" });
  const [grantDraft, setGrantDraft] = useState(initialGrant);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [grantReview, setGrantReview] = useState<Record<string, string>>({});
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const result = await officeJson<State>();
      setState(result); setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Role portfolio unavailable");
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function act(payload: Action, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await officeJson(payload);
      await reload();
      setNotice(success);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Role-seat update rejected");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const acting = state?.actor.user_id;
  const ownedSeats = (state?.seats ?? []).filter(seat => seat.current_holder_user_id === acting);
  const selectedSeat = (state?.seats ?? []).find(seat => seat.id === (focusSeatId ?? selected)) ?? null;
  const currentSeatTransfers = useMemo(() =>
    (state?.transfers ?? []).filter(transfer => selectedSeat === null || transfer.seat_id === selectedSeat.id),
    [state?.transfers, selectedSeat]);
  const people = state?.people ?? [];
  const personName = (id?: string | null) => people.find(person => person.user_id === id)?.display_name || (id ? "Assigned employee" : "Vacant");

  if (!state) return <section className={styles.state}>
    <ShieldAlert size={24} /><h2>Role portfolio</h2>
    <p>{error || "Loading governed roles, current holders, transfers and access evidence…"}</p>
    <button type="button" onClick={() => void reload()}><RefreshCw size={16} /> Retry</button>
  </section>;

  if (focusSeatId && !selectedSeat) return <section className={styles.state}>
    <LockKeyhole /><h2>Role seat unavailable</h2>
    <p>That role is not assigned to you or is not within your authorized review scope.</p>
    <Link href="/office/my-portfolio">Return to My Portfolio</Link>
  </section>;

  return <section className={styles.shell} aria-label="KRAVIA role portfolio">
    <header className={styles.hero}>
      <div className={styles.heroTop}><Layers3 size={21}/><span>MY PORTFOLIO · ROLE AUTHORITY</span></div>
      <h2>{selectedSeat ? selectedSeat.label : "Roles, responsibilities and governed transfers"}</h2>
      <p>One company identity. Independent operational seats. Transfers require the recipient and independent review.</p>
      <div className={styles.heroActions}>
        {selectedSeat ? <Link href="/office/my-portfolio">All roles <ChevronRight size={16}/></Link> : null}
        <button type="button" onClick={() => void reload()} disabled={busy}><RefreshCw size={16}/> Refresh</button>
        {state.actor.is_owner ? <button type="button" className={styles.primary} onClick={() => setCreateOpen(value => !value)}>
          <Plus size={16}/> Register role seat
        </button> : null}
      </div>
    </header>

    {error ? <p className={styles.error} role="alert"><ShieldAlert size={18}/>{error}</p> : null}
    {notice ? <p className={styles.success} role="status"><CheckCircle2 size={18}/>{notice}</p> : null}

    <div className={styles.stats}>
      <article><span>My active seats</span><b>{ownedSeats.length}</b></article>
      <article><span>Transfer requests</span><b>{(state.transfers ?? []).filter(t => ["PROPOSED", "ACCEPTED"].includes(t.status)).length}</b></article>
      <article><span>All visible seats</span><b>{state.seats.length}</b></article>
      <article><span>Security context</span><b>AAL2</b></article>
    </div>

    {state.current_job ? <section className={styles.legacy}>
      <div><UserRound size={19}/><span><b>Verified existing primary job</b>
        <small>{state.current_job.position_code.replaceAll("_"," ")} · {state.current_job.department_code} · {state.current_job.status}</small>
      </span></div>
      <p>Existing job, title and security roles remain separate from transferable role seats. No new CTO, Developer, CFO or CEO seat is inferred from these records.</p>
    </section> : null}

    {state.actor.is_owner && state.employee_directory.length > 0 && !selectedSeat ? <section className={styles.card}>
      <header className={styles.cardHead}><div><h3>Verified employee transfer inventory</h3><p>Current directory roles are not equivalent to accepted handovers.</p></div><UsersRound size={20}/></header>
      <div className={styles.employeeGrid}>{state.employee_directory.map(person => <article key={person.user_id} className={styles.person}>
        <b>{person.display_name}</b><span>{person.job_title || "Unspecified directory title"}</span>
        <small>Primary job: {person.primary_job ? person.primary_job.position_code + " · " + person.primary_job.status : "Not recorded"}</small>
        <small>Security roles: {person.security_roles.join(", ") || "None recorded"}</small>
        <small>Access profiles: {person.profiles.map(profile => profile.profile_code + " · " + profile.status).join(", ") || "No active assignment records"}</small>
      </article>)}</div>
    </section> : null}

    {createOpen && state.actor.is_owner ? <section className={styles.card}>
      <header className={styles.cardHead}><div><h3>Create a vacant role seat</h3>
        <p>Register the position before assigning anyone. Creation grants no employee any permissions.</p></div>
        <button className={styles.icon} type="button" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={18}/></button>
      </header>
      <form className={styles.form} onSubmit={event => {
        event.preventDefault();
        void act({ action:"CREATE", ...seatDraft }, "Role seat registered without authority grants.").then(ok => {
          if (ok) { setCreateOpen(false); setSeatDraft(initialSeat); }
        });
      }}>
        <label>Seat code<input required pattern="[A-Z][A-Z0-9_]{2,63}" value={seatDraft.code} onChange={e=>setSeatDraft(d=>({...d,code:e.target.value.toUpperCase()}))} placeholder="CTO_MAIN"/></label>
        <label>Position<select required value={seatDraft.position} onChange={e=>setSeatDraft(d=>({...d,position:e.target.value}))}>
          <option value="">Select a position</option>{state.positions.filter(position=>position.code!=="OWNER_FOUNDER").map(position=><option key={position.code} value={position.code}>{position.label}</option>)}
        </select></label>
        <label>Department<select required value={seatDraft.department} onChange={e=>setSeatDraft(d=>({...d,department:e.target.value}))}>
          <option value="">Select a department</option>{state.departments.map(dept=><option key={dept.code} value={dept.code}>{dept.label}</option>)}
        </select></label>
        <label>Role label<input required minLength={3} maxLength={120} value={seatDraft.label} onChange={e=>setSeatDraft(d=>({...d,label:e.target.value}))} placeholder="Chief Technology Officer"/></label>
        <label className={styles.wide}>Mandate<textarea maxLength={2000} rows={3} value={seatDraft.description} onChange={e=>setSeatDraft(d=>({...d,description:e.target.value}))} placeholder="Responsible for engineering architecture and technical leadership"/></label>
        <label className={styles.checkbox}><input type="checkbox" checked={seatDraft.requires_department_handover} onChange={e=>setSeatDraft(d=>({...d,requires_department_handover:e.target.checked}))}/>
          Department leadership requires a separately accepted ownership handover
        </label>
        <div className={styles.wide}><button type="submit" disabled={busy} className={styles.primary}><Plus size={16}/> Register vacant seat</button></div>
      </form>
    </section> : null}

    <section className={styles.card}>
      <header className={styles.cardHead}><div><h3>{selectedSeat ? "Current role authority" : "Role seats"}</h3>
        <p>Current holder, permitted responsibility and transfer state.</p></div><ShieldCheck size={21}/></header>
      {state.seats.filter(seat=>!selectedSeat||selectedSeat.id===seat.id).length ? <div className={styles.seatGrid}>
        {state.seats.filter(seat=>!selectedSeat||selectedSeat.id===seat.id).map(seat=><article className={styles.seat} key={seat.id}>
          <div className={styles.seatTop}><span className={styles.seatCode}>{seat.seat_code}</span><span className={styles.pill} data-status={seat.status}>{seat.status}</span></div>
          <h4>{seat.label}</h4>
          <p>{seat.description || "Accountable responsibilities must be documented and reviewed."}</p>
          <div className={styles.kv}><span>Position<b>{seat.position_code}</b></span><span>Department<b>{seat.department_code}</b></span>
            <span>Current holder<b>{personName(seat.current_holder_user_id)}</b></span><span>Revision<b>v{seat.version}</b></span></div>
          {seat.department_ownership_required ? <small>Formal department ownership acceptance required</small> : null}
          {!focusSeatId ? <Link className={styles.outlineAction} href={"/office/my-portfolio/" + encodeURIComponent(seat.id)}>
            Inspect seat & handover <ArrowRight size={16}/>
          </Link> : null}
        </article>)}
      </div> : <p className={styles.empty}>No registered seats yet. Existing positions and permissions remain unchanged.</p>}
    </section>

    {selectedSeat ? <>
      <section className={styles.card}>
        <header className={styles.cardHead}><div><h3>Scoped role-seat grants</h3><p>Only explicit ACTIVE grants are available to the current holder.</p></div><KeyRound size={20}/></header>
        <div className={styles.grantList}>{state.grants.filter(g=>g.seat_id===selectedSeat.id).map(grant=><article key={grant.id} className={styles.grant}>
          <div><b>{grant.permission_code}</b><small>{grant.scope_type}{grant.scope_key ? " · " + grant.scope_key : ""}{grant.exclusive ? " · exclusive operational authority" : ""}</small></div>
          <span className={styles.pill} data-status={grant.status}>{grant.status}</span>
          {grant.status==="PENDING" && state.actor.is_reviewer && grant.created_by!==acting && selectedSeat.current_holder_user_id!==acting ?
            <div className={styles.grantActions}><input aria-label="Grant review reason" value={grantReview[grant.id]||""} placeholder="Independent security review reference" onChange={e=>setGrantReview(x=>({...x,[grant.id]:e.target.value}))}/>
              <button type="button" disabled={busy || (grantReview[grant.id]||"").length<8}
                onClick={()=>void act({action:"REVIEW_GRANT",grant_id:grant.id,approve:true,reason:grantReview[grant.id]},"Grant approved by independent reviewer.")}>Approve</button>
              <button type="button" disabled={busy || (grantReview[grant.id]||"").length<8}
                onClick={()=>void act({action:"REVIEW_GRANT",grant_id:grant.id,approve:false,reason:grantReview[grant.id]},"Grant rejected.")}>Reject</button>
            </div>:null}
        </article>)}{!state.grants.some(g=>g.seat_id===selectedSeat.id)?<p className={styles.empty}>No seat grants configured. The role title alone conveys no operational authority.</p>:null}</div>
        {state.actor.is_owner ? <form className={styles.grantForm} onSubmit={e=>{e.preventDefault();void act({
          action:"GRANT",seat_id:selectedSeat.id,permission:grantDraft.permission,
          scope_type:grantDraft.scope_type,scope_key:["COMPANY","OWN"].includes(grantDraft.scope_type)?null:grantDraft.scope_key,
          exclusive:grantDraft.exclusive,
        },"Role-seat grant recorded. High-risk permissions await independent review.").then(ok=>{if(ok)setGrantDraft(initialGrant);});}}>
          <h4>Configure a scoped grant</h4>
          <label>Permission<select required value={grantDraft.permission} onChange={e=>setGrantDraft(x=>({...x,permission:e.target.value}))}>
            <option value="">Choose current permission</option>{state.permissions.filter(p=>p.owner_bypass).map(p=><option key={p.code} value={p.code}>{p.code}{p.high_risk?" · high risk":""}</option>)}
          </select></label>
          <label>Scope<select value={grantDraft.scope_type} onChange={e=>setGrantDraft(x=>({...x,scope_type:e.target.value}))}>
            {scopeTypes.map(s=><option key={s} value={s}>{s}</option>)}
          </select></label>
          {!["COMPANY","OWN"].includes(grantDraft.scope_type)?<label>Scope key<input required value={grantDraft.scope_key} onChange={e=>setGrantDraft(x=>({...x,scope_key:e.target.value}))} placeholder="Project, repository or department code"/></label>:null}
          <label className={styles.checkbox}><input type="checkbox" checked={grantDraft.exclusive} onChange={e=>setGrantDraft(x=>({...x,exclusive:e.target.checked}))}/> Revoke from former seat holders after transfer (write permissions only)</label>
          <button type="submit" disabled={busy||!grantDraft.permission} className={styles.outlineAction}>Record grant <Plus size={15}/></button>
        </form> : null}
      </section>

      {(selectedSeat.current_holder_user_id===acting||state.actor.is_owner)&&
        !state.transfers.some(t=>t.seat_id===selectedSeat.id&&["PROPOSED","ACCEPTED"].includes(t.status)) ?
        <section className={styles.card}>
          <header className={styles.cardHead}><div><h3>{selectedSeat.current_holder_user_id?"Propose role transfer":"Appoint first holder"}</h3>
            <p>Proposal makes no permission change. The recipient must accept; an independent reviewer completes the cutover.</p></div><ArrowRightLeft size={20}/></header>
          <form className={styles.form} onSubmit={e=>{e.preventDefault();void act({
            action:"PROPOSE",seat_id:selectedSeat.id,recipient_id:transferDraft.recipient,reason:transferDraft.reason,
          },"Transfer proposed. No access changes until reviewed and finalized.").then(ok=>{if(ok)setTransferDraft({recipient:"",reason:""});});}}>
            <label>Successor<select required value={transferDraft.recipient} onChange={e=>setTransferDraft(x=>({...x,recipient:e.target.value}))}>
              <option value="">Select an active employee</option>{people.filter(person=>person.user_id!==selectedSeat.current_holder_user_id).map(person=>
                <option key={person.user_id} value={person.user_id}>{person.display_name}</option>)}
            </select></label>
            <label className={styles.wide}>Transfer reason<textarea required rows={3} minLength={12} maxLength={2000}
              value={transferDraft.reason} onChange={e=>setTransferDraft(x=>({...x,reason:e.target.value}))}
              placeholder="Responsibilities, effective cutover purpose, and the proposed successor's mandate"/></label>
            <div className={styles.wide}><button type="submit" className={styles.primary} disabled={busy||!transferDraft.recipient||transferDraft.reason.trim().length<12}>
              <Send size={16}/> Submit for recipient acceptance
            </button></div>
          </form>
        </section> : null}
    </> : null}

    <section className={styles.card}>
      <header className={styles.cardHead}><div><h3>Role handover register</h3>
        <p>Proposal → Recipient acceptance → Independent evidence review → Controlled cutover.</p></div><ClipboardList size={21}/></header>
      {currentSeatTransfers.length ? <div className={styles.transferList}>{currentSeatTransfers.map(tr=><article className={styles.transfer} key={tr.id}>
        <div className={styles.transferTitle}><div><b>{state.seats.find(s=>s.id===tr.seat_id)?.label || "Role seat"}</b>
          <small>{personName(tr.from_user_id)} → {personName(tr.to_user_id)} · {formatDate(tr.proposed_at)}</small></div>
          <span className={styles.pill} data-status={tr.status}>{tr.status}</span></div>
        <p>{tr.reason}</p>
        {tr.status==="PROPOSED" && tr.to_user_id===acting ? <button type="button" className={styles.primary} disabled={busy}
          onClick={()=>void act({action:"ACCEPT",transfer_id:tr.id},"You accepted the role. Independent verification is still required.")}>
          <BadgeCheck size={16}/> Accept responsibilities</button> : null}
        {tr.status==="ACCEPTED" ? <div className={styles.checklist}>
          <h4>Handover evidence</h4>
          {state.items.filter(item=>item.transfer_id===tr.id).map(item=><div key={item.id} className={styles.checkItem}>
            <div><FileCheck2 size={17}/><span><b>{item.label}</b><small>{item.category} · {item.required?"Required":"Optional"}</small></span></div>
            <span className={styles.pill} data-status={item.status}>{item.status}</span>
            {item.status==="PENDING" && state.actor.is_reviewer && acting!==tr.to_user_id && acting!==tr.from_user_id ?
              <div className={styles.checkAction}><input aria-label={"Verification reference for "+item.label}
                placeholder="Verified evidence reference (not passwords or tokens)"
                value={evidence[item.id]||""} onChange={e=>setEvidence(x=>({...x,[item.id]:e.target.value}))}/>
                <button type="button" disabled={busy||(evidence[item.id]||"").length<8}
                  onClick={()=>void act({action:"VERIFY_ITEM",item_id:item.id,evidence:evidence[item.id]},"Checklist evidence verified.")}>
                  Verify</button></div> : null}
            {item.status==="VERIFIED"&&item.evidence_reference?<small>Evidence: {item.evidence_reference}</small>:null}
          </div>)}
          {state.actor.is_reviewer && acting!==tr.to_user_id && acting!==tr.from_user_id ? <div className={styles.checkAction}>
            <input aria-label="Final cutover evidence" placeholder="Independent cutover evidence reference"
              value={evidence[tr.id]||""} onChange={e=>setEvidence(x=>({...x,[tr.id]:e.target.value}))}/>
            <button type="button" className={styles.primary}
              disabled={busy||(evidence[tr.id]||"").length<8||
                state.items.some(i=>i.transfer_id===tr.id&&i.required&&i.status!=="VERIFIED")}
              onClick={()=>void act({action:"FINALIZE",transfer_id:tr.id,evidence:evidence[tr.id]},"Role handover completed and prior seat authority revoked.")}>
              <ShieldCheck size={16}/> Finalize controlled cutover
            </button></div> : null}
        </div> : null}
        {["PROPOSED","ACCEPTED"].includes(tr.status) && (acting===tr.proposed_by||acting===tr.from_user_id||acting===tr.to_user_id||state.actor.is_owner) ?
          <div className={styles.cancel}><input aria-label="Cancellation reason" placeholder="Reason for cancelling"
            value={cancelReasons[tr.id]||""} onChange={e=>setCancelReasons(x=>({...x,[tr.id]:e.target.value}))}/>
            <button type="button" disabled={busy||(cancelReasons[tr.id]||"").trim().length<8}
              onClick={()=>void act({action:"CANCEL",transfer_id:tr.id,reason:cancelReasons[tr.id]},"Handover cancelled; no role-seat authority was transferred.")}>Cancel transfer</button>
          </div>:null}
      </article>)}</div>:<p className={styles.empty}>No pending or historical role-seat handovers are visible to you.</p>}
    </section>

    <section className={styles.notes}>
      <Shield size={20}/>
      <div><b>Separation of authority</b>
        <p>Founder authority, the employee's primary job, functional positions, scoped seat grants,
          Finance payment approvals, legal appointments and provider access are independently governed.
          A handover never copies secrets or implies that a cloud provider's access was transferred.</p>
        <p>For an Engineering or Finance head, first record the separate departmental handover in
          <Link href="/office/department-ownership"> Department ownership</Link>. For account guidance, use
          <Link href="/office/info"> Info &amp; Help</Link>.</p>
      </div>
    </section>
    <footer className={styles.footer}><BookOpen size={14}/> KRAVIA Office · Verified role portfolio · No implied statutory appointment or payroll authority</footer>
  </section>;
}
