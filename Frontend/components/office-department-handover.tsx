"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, CircleAlert, LoaderCircle, ShieldCheck, X } from "lucide-react";
import styles from "./office-department-handover.module.css";
import {OfficeActionState} from "./office-action-state";

type Department = { code: string; label: string };
type Person = { user_id: string; display_name?: string | null };
type Ownership = { department_code: string; owner_user_id: string; previous_owner_user_id?: string | null; version: number };
type Transfer = { id: string; department_code: string; from_owner_user_id: string; to_owner_user_id: string; status: string; reason: string; decided_at?: string | null };
type Response = {
  actor: { user_id: string; founder: boolean };
  departments: Department[];
  ownership: Ownership[];
  transfers: Transfer[];
  people: Person[];
};

async function api<T>(body?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/office-departments", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Department ownership request failed");
  return data as T;
}

export function OfficeDepartmentHandover({ mode = "manage" }: { mode?: "manage" | "recipient" }) {
  const router = useRouter();
  const [data, setData] = useState<Response>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Department>();
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reauthRequired, setReauthRequired] = useState(false);
  const refresh = useCallback(async () => {
    const fresh = await api<Response>();
    setData(fresh);
    return fresh;
  }, []);
  useEffect(() => {
    if (mode !== "recipient" || !data) return;
    const incoming = data.transfers.filter(t => t.to_owner_user_id === data.actor.user_id);
    const latest = incoming.filter(t => t.status === "ACCEPTED")
      .map(t => t.decided_at || t.id).sort().join("|");
    const noPending = !incoming.some(t => t.status === "PENDING");
    let acknowledged = false;
    try {
      acknowledged = window.sessionStorage.getItem("kravia.office.transfer.reauth." + data.actor.user_id) === latest;
    } catch { /* Browser may disallow session storage. */ }
    const frame = window.requestAnimationFrame(() => {
      setReauthRequired(noPending && latest.length > 0 && !acknowledged);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, data]);

  async function signOutForHandover() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/office-auth/sign-out", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sign-out failed. Use the account menu and retry.");
      if (data) {
        const latest = data.transfers.filter(t => t.to_owner_user_id === data.actor.user_id && t.status === "ACCEPTED")
          .map(t => t.decided_at || t.id).sort().join("|");
        try { window.sessionStorage.setItem("kravia.office.transfer.reauth." + data.actor.user_id, latest); }
        catch { /* No storage persistence required for security. */ }
      }
      router.replace("/office/login");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign out");
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void api<Response>().then((value) => { if (active) setData(value); }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to read handover records");
    });
    return () => { active = false; };
  }, []);

  async function transact(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(body);
      // The authoritative mutation is complete; refreshing a read-only list
      // must never turn a successful transfer into a false failure message.
      setSelected(undefined); setRecipient(""); setReason("");
      setNotice(success);
      try { await refresh(); }
      catch { setError("Transfer recorded. Refresh the ownership list to see the latest state."); }
      // Acceptance changes the effective authority matrix and navigation.
      if (body.action === "ACCEPT") router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete handover");
    } finally { setBusy(false); }
  }
  function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !recipient || reason.trim().length < 12) return;
    void transact({ action: "PROPOSE", department: selected.code, recipient, reason }, "Handover proposed. No access has changed until the recipient accepts.");
  }
  useEffect(() => {
    if(!selected)return;
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!busy)setSelected(undefined);
    };
    window.addEventListener("keydown",onEscape);
    return()=>window.removeEventListener("keydown",onEscape);
  },[selected,busy]);

  if (!data) return <section className={styles.shell} aria-label="Department ownership">
    <h2>Department ownership</h2>
    {error?<><OfficeActionState kind="error" label={error} compact/>
      <button type="button" className={styles.retry} onClick={()=>{setError("");void refresh().catch(e=>setError(e instanceof Error?e.message:"Unable to load departments"));}}>Retry</button></>:
      <p className={styles.loading}>Loading departments…</p>}
  </section>;

  const named=(id?:string|null)=>data.people.find(person=>person.user_id===id)?.display_name||
    (id===data.actor.user_id?"You":"Assigned employee");
  // The recipient sees only handovers explicitly addressed to their own identity.
  const incoming=data.transfers.filter(t=>t.to_owner_user_id===data.actor.user_id);
  const visibleTransfers=mode==="recipient"?incoming:data.transfers;
  const departments=mode==="recipient"
    ?data.departments.filter(dept=>incoming.some(t=>t.department_code===dept.code))
    :data.departments;
  const pendingCount=incoming.filter(t=>t.status==="PENDING").length;
  return <section className={styles.shell} aria-label="Department ownership">
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}>KRAVIA OFFICE · ADMINISTRATION</span>
        <h2>{mode==="recipient"?"My transfers":"Department ownership"}</h2>
        <p>{mode==="recipient"?`${pendingCount} transfer${pendingCount===1?"":"s"} awaiting your review`:
          "Assign department responsibility. Recipient acceptance is required."}</p>
      </div>
    </header>
    {notice?<OfficeActionState kind="success" label={notice} compact/>:null}
    {error&&!selected?<OfficeActionState kind="error" label={error} compact/>:null}
    {mode==="recipient"&&reauthRequired&&pendingCount===0?<div role="status" className={styles.reauth}>
      <div><ShieldCheck size={19} aria-hidden="true"/><span>
        <strong>Department access updated</strong>
        <small>Sign out and sign back in to refresh your current access.</small>
      </span></div>
      <button type="button" disabled={busy} onClick={()=>void signOutForHandover()}>
        Sign out to refresh access
      </button>
    </div>:null}
    {departments.length?<div className={styles.tableWrap} role="region" aria-label="Department ownership table">
      <table className={styles.table}>
        <thead><tr><th scope="col">Department</th><th scope="col">Current owner</th>
          <th scope="col">Status</th><th scope="col" className={styles.last}>Action</th></tr></thead>
        <tbody>{departments.map(dept=>{
          const record=data.ownership.find(item=>item.department_code===dept.code);
          const pending=visibleTransfers.find(t=>t.department_code===dept.code&&t.status==="PENDING");
          const accepted=visibleTransfers.find(t=>t.department_code===dept.code&&t.status==="ACCEPTED");
          const owner=record?.owner_user_id;
          const canPropose=mode==="manage"&&((!record&&data.actor.founder)||owner===data.actor.user_id);
          const canAccept=pending?.to_owner_user_id===data.actor.user_id;
          const canCancel=mode==="manage"&&pending&&
            (pending.from_owner_user_id===data.actor.user_id||canAccept);
          return <tr key={dept.code}>
            <th scope="row"><strong>{dept.label}</strong><small>{record?"Revision "+record.version:"Founder authority"}</small></th>
            <td>{owner?named(owner):"Founder (not delegated)"}</td>
            <td><span className={styles.status} data-pending={Boolean(pending)}>
                {pending?"Awaiting "+named(pending.to_owner_user_id):"Active"}
              </span>
              {pending&&mode==="recipient"?<small className={styles.reason}>Reason: {pending.reason}</small>:null}
              {accepted&&mode==="recipient"&&!pending?<small className={styles.reason}>Accepted. Subject to existing role permissions.</small>:null}
            </td>
            <td className={styles.last}><div className={styles.actions}>
              {canPropose&&!pending?<button type="button" disabled={busy} onClick={()=>{setSelected(dept);setNotice("");setError("");}}>
                <ArrowRightLeft size={15}/>Transfer</button>:null}
              {pending&&canAccept?<button type="button" disabled={busy}
                onClick={()=>{
                  if(window.confirm(`Accept ownership of ${dept.label}? This changes departmental write and approval rights.`))
                    void transact({action:"ACCEPT",transfer_id:pending.id},
                      "Ownership accepted. The former owner's departmental write access has been revoked.");
                }}><Check size={15}/>Review &amp; accept</button>:null}
              {pending&&canCancel?<button type="button" className={styles.secondary}
                disabled={busy} onClick={()=>void transact({action:"CANCEL",transfer_id:pending.id},
                  "Transfer cancelled. Access was unchanged.")}><X size={15}/>Cancel</button>:null}
              {!canPropose&&!canAccept&&!canCancel?<span className={styles.dash}>—</span>:null}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>:<div className={styles.empty}>
      <OfficeActionState kind="not-found" label={mode==="recipient"?"No incoming transfers.":"No departments available."}/>
    </div>}
    {selected&&mode==="manage"?<div className={styles.backdrop} role="presentation"
      onMouseDown={()=>{if(!busy)setSelected(undefined);}}>
      <form className={styles.dialog} role="dialog" aria-modal="true"
        aria-labelledby="office-transfer-title" aria-describedby="office-transfer-summary"
        onSubmit={propose} onMouseDown={event=>event.stopPropagation()}>
        <header><div><span className={styles.eyebrow}>HANDOVER REQUEST</span>
          <h3 id="office-transfer-title">Transfer {selected.label}</h3></div>
          <button type="button" className={styles.close} onClick={()=>setSelected(undefined)}
            disabled={busy} aria-label="Close transfer"><X size={18}/></button></header>
        <p id="office-transfer-summary" className={styles.warning}>
          <CircleAlert size={16}/>Permanent transfer requires the recipient&apos;s acceptance.
          No access changes when this request is submitted.
        </p>
        {error?<OfficeActionState kind="error" label={error} compact/>:null}
        <label>New owner<select required autoFocus value={recipient}
          onChange={event=>setRecipient(event.target.value)} disabled={busy}>
          <option value="">Select active team member</option>
          {data.people.filter(person=>person.user_id!==data.actor.user_id).map(person=>
            <option key={person.user_id} value={person.user_id}>{person.display_name||person.user_id}</option>)}
        </select></label>
        <label>Reason for transfer<textarea required minLength={12} maxLength={1000}
          value={reason} onChange={event=>setReason(event.target.value)}
          placeholder="What responsibility is being handed over?" disabled={busy}/></label>
        <footer><button type="button" className={styles.secondary} onClick={()=>setSelected(undefined)}
          disabled={busy}>Cancel</button>
          <button type="submit" disabled={busy||!recipient||reason.trim().length<12}>
            {busy?<LoaderCircle size={16} className={styles.spin}/>:<ArrowRightLeft size={16}/>}
            Request transfer</button></footer>
      </form>
    </div>:null}
  </section>;
}
