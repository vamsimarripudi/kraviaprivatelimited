"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleAlert, Laptop, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import styles from "./office-device-identity.module.css";

type Capabilities = {
  company_cards: boolean; own_card: boolean; posture_read: boolean; physical_read: boolean;
  card_manage: boolean; posture_manage: boolean; physical_manage: boolean;
};
type Identity = { user_id: string; display_name?: string | null; job_title?: string | null; primary_department?: string | null; status: string };
type Credential = { id: string; credential_code: string; user_id: string; credential_kind: string; status: string; issued_at: string; expires_at?: string | null; revocation_reason?: string | null };
type Device = { id: string; user_id: string; device_label: string; device_kind: string; platform?: string | null; trust_state: string; company_managed: boolean; approved_at?: string | null; revoked_at?: string | null; last_seen_at?: string | null };
type Posture = { id: number; device_id: string; checked_at: string; os_version?: string | null; encryption_enabled?: boolean | null; screen_lock_enabled?: boolean | null; security_agent_healthy?: boolean | null; patch_current?: boolean | null; firewall_enabled?: boolean | null; compromise_detected: boolean; compliance_status: string; source: string };
type Zone = { id: string; zone_code: string; name: string; classification: string; description?: string | null; active: boolean };
type Grant = { id: string; user_id: string; zone_id: string; credential_id?: string | null; effective_from: string; effective_to?: string | null; status: string; reason: string };
type Payload = { actor: { user_id: string }; capabilities: Capabilities; identities: Identity[]; credentials: Credential[]; devices: Device[]; postures: Posture[]; zones: Zone[]; grants: Grant[]; disclaimer: string };
type View = "identity" | "devices" | "access";
type Modal =
  | { kind: "ISSUE" }
  | { kind: "POSTURE"; device: Device }
  | { kind: "ZONE" }
  | { kind: "GRANT" }
  | { kind: "REVOKE_CREDENTIAL"; credential: Credential }
  | { kind: "REVOKE_GRANT"; grant: Grant };

async function api<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/office-device-identity", { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Identity/device request failed");
  return body as T;
}
function date(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function yn(value?: boolean | null) { return value === true ? "Yes" : value === false ? "No" : "Unknown"; }

export function OfficeDeviceIdentity() {
  const [data, setData] = useState<Payload>();
  const [view, setView] = useState<View>("identity");
  const [modal, setModal] = useState<Modal>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [oneTimeToken, setOneTimeToken] = useState<string>();

  async function reload(message?: string) {
    const next = await api<Payload>();
    setData(next);
    if (message) setNotice(message);
  }
  useEffect(() => {
    let alive = true;
    void api<Payload>().then((next) => { if (alive) setData(next); }).catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Unable to load identity/device controls"); });
    return () => { alive = false; };
  }, []);

  const people = useMemo(() => new Map((data?.identities ?? []).map((row) => [row.user_id, row])), [data?.identities]);
  const latestPosture = useMemo(() => {
    const map = new Map<string, Posture>();
    for (const row of data?.postures ?? []) if (!map.has(row.device_id)) map.set(row.device_id, row);
    return map;
  }, [data?.postures]);
  const zones = useMemo(() => new Map((data?.zones ?? []).map((row) => [row.id, row])), [data?.zones]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setBusy(true); setError(undefined); setOneTimeToken(undefined);
    try {
      if (modal.kind === "ISSUE") {
        const result = await api<{ activation_token: string }>({
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ISSUE_CREDENTIAL", user_id: draft.user_id, kind: draft.kind || "DIGITAL_ID", expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : undefined }),
        });
        setOneTimeToken(result.activation_token);
        await reload("Credential issued. The activation token below is displayed once and is not stored by KRAVIA Office.");
        return;
      }
      if (modal.kind === "POSTURE") {
        await api({
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "RECORD_POSTURE", device_id: modal.device.id, os_version: draft.os_version || undefined,
            encryption: draft.encryption === "YES", screen_lock: draft.screen_lock === "YES", security_agent: draft.security_agent === "YES",
            patch_current: draft.patch_current === "YES", firewall: draft.firewall === "YES", compromise: draft.compromise === "YES",
            status: draft.status || "UNKNOWN", source: draft.source || "MANUAL_ATTESTATION",
          }),
        });
        await reload("Device posture recorded. Non-compliant or compromised devices are revoked by policy.");
      } else if (modal.kind === "ZONE") {
        await api({
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CREATE_ZONE", code: draft.code, name: draft.name, classification: draft.classification || "INTERNAL", description: draft.description || undefined }),
        });
        await reload("Physical access zone created.");
      } else if (modal.kind === "GRANT") {
        await api({
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "GRANT_ZONE", user_id: draft.user_id, zone_id: draft.zone_id, credential_id: draft.credential_id || undefined, effective_to: draft.effective_to ? new Date(draft.effective_to).toISOString() : undefined, reason: draft.reason }),
        });
        await reload("Physical access granted with an auditable authority record.");
      } else if (modal.kind === "REVOKE_CREDENTIAL") {
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REVOKE_CREDENTIAL", credential_id: modal.credential.id, reason: draft.reason }) });
        await reload("Credential revoked and linked physical-access grants were closed.");
      } else {
        await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REVOKE_ZONE", grant_id: modal.grant.id, reason: draft.reason }) });
        await reload("Physical access grant revoked.");
      }
      setModal(undefined); setDraft({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Identity/device action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <section className={styles.state}><CircleAlert /><div><h2>Identity & devices unavailable</h2><p>{error}</p></div></section>;
  if (!data) return <section className={styles.state}><LoaderCircle className={styles.spin} /><div><h2>Loading identity & devices</h2><p>Resolving credential, device and physical-access authority.</p></div></section>;

  const activeCredentials = data.credentials.filter((row) => row.status === "ACTIVE").length;
  const compliantDevices = data.devices.filter((row) => latestPosture.get(row.id)?.compliance_status === "COMPLIANT").length;
  const activeGrants = data.grants.filter((row) => row.status === "ACTIVE").length;

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div><p>IDENTITY · DEVICE TRUST · PHYSICAL ACCESS</p><h2>One company identity across software, devices and future office access.</h2><span>{data.disclaimer}</span></div>
      <div className={styles.metrics}><article><b>{activeCredentials}</b><span>active credentials</span></article><article><b>{compliantDevices}</b><span>compliant devices</span></article><article><b>{activeGrants}</b><span>active zone grants</span></article></div>
    </header>

    <div className={styles.toolbar}>
      {(["identity", "devices", "access"] as View[]).map((item) => <button type="button" key={item} data-active={view === item} onClick={() => setView(item)}>{item === "identity" ? "Digital ID" : item === "devices" ? "Devices" : "Physical access"}</button>)}
      <button type="button" onClick={() => void reload()}><RefreshCw /> Refresh</button>
      {view === "identity" && data.capabilities.card_manage ? <button type="button" onClick={() => { setDraft({ kind: "DIGITAL_ID" }); setModal({ kind: "ISSUE" }); }}><Plus /> Issue credential</button> : null}
      {view === "access" && data.capabilities.physical_manage ? <><button type="button" onClick={() => { setDraft({ classification: "INTERNAL" }); setModal({ kind: "ZONE" }); }}><Plus /> New zone</button><button type="button" onClick={() => { setDraft({}); setModal({ kind: "GRANT" }); }}><ShieldCheck /> Grant access</button></> : null}
    </div>

    {notice ? <div className={styles.notice}><BadgeCheck />{notice}</div> : null}
    {error ? <div className={styles.error}><CircleAlert />{error}</div> : null}
    {oneTimeToken ? <div className={styles.token}><b>One-time credential token</b><br />{oneTimeToken}<br /><small>Encode or provision this once through the authorised card/digital-ID workflow. KRAVIA stores only its SHA-256 digest.</small></div> : null}

    {view === "identity" ? <div className={styles.grid}>{data.credentials.map((row) => <article className={styles.card} key={row.id}>
      <header><div><small>{row.credential_code}</small><h3>{row.credential_kind.replaceAll("_", " ")}</h3><span>{people.get(row.user_id)?.display_name || row.user_id}</span></div><em className={styles.badge} data-status={row.status}>{row.status}</em></header>
      <div className={styles.kv}><span>Issued<b>{date(row.issued_at)}</b></span><span>Expires<b>{date(row.expires_at)}</b></span></div>
      {data.capabilities.card_manage && row.status === "ACTIVE" ? <div className={styles.actions}><button type="button" onClick={() => { setDraft({ reason: "" }); setModal({ kind: "REVOKE_CREDENTIAL", credential: row }); }}>Revoke</button></div> : null}
    </article>)}{!data.credentials.length ? <div className={styles.empty}>No credential exists in your authorised scope.</div> : null}</div> : null}

    {view === "devices" ? <div className={styles.grid}>{data.devices.map((row) => {
      const posture = latestPosture.get(row.id);
      return <article className={styles.card} key={row.id}>
        <header><div><small>{row.device_kind}</small><h3>{row.device_label}</h3><span>{people.get(row.user_id)?.display_name || "Assigned identity"} · {row.platform || "Unknown platform"}</span></div><em className={styles.badge} data-status={posture?.compliance_status || row.trust_state}>{posture?.compliance_status || row.trust_state}</em></header>
        <div className={styles.kv}><span>Company managed<b>{row.company_managed ? "Yes" : "No"}</b></span><span>Last seen<b>{date(row.last_seen_at)}</b></span><span>Encryption<b>{yn(posture?.encryption_enabled)}</b></span><span>Security agent<b>{yn(posture?.security_agent_healthy)}</b></span><span>Patch current<b>{yn(posture?.patch_current)}</b></span><span>Compromise<b>{yn(posture?.compromise_detected)}</b></span></div>
        {data.capabilities.posture_manage ? <div className={styles.actions}><button type="button" onClick={() => { setDraft({ status: posture?.compliance_status || "UNKNOWN", source: "MANUAL_ATTESTATION", os_version: posture?.os_version || "", encryption: posture?.encryption_enabled ? "YES" : "NO", screen_lock: posture?.screen_lock_enabled ? "YES" : "NO", security_agent: posture?.security_agent_healthy ? "YES" : "NO", patch_current: posture?.patch_current ? "YES" : "NO", firewall: posture?.firewall_enabled ? "YES" : "NO", compromise: posture?.compromise_detected ? "YES" : "NO" }); setModal({ kind: "POSTURE", device: row }); }}><Laptop /> Record posture</button></div> : null}
      </article>;
    })}{!data.devices.length ? <div className={styles.empty}>No registered devices in your authorised scope.</div> : null}</div> : null}

    {view === "access" ? <div className={styles.grid}>{data.grants.map((row) => <article className={styles.card} key={row.id}>
      <header><div><small>{zones.get(row.zone_id)?.zone_code || "ZONE"}</small><h3>{zones.get(row.zone_id)?.name || "Physical access zone"}</h3><span>{people.get(row.user_id)?.display_name || row.user_id}</span></div><em className={styles.badge} data-status={row.status}>{row.status}</em></header>
      <div className={styles.kv}><span>From<b>{date(row.effective_from)}</b></span><span>Until<b>{date(row.effective_to)}</b></span><span>Classification<b>{zones.get(row.zone_id)?.classification || "—"}</b></span><span>Reason<b>{row.reason}</b></span></div>
      {data.capabilities.physical_manage && row.status === "ACTIVE" ? <div className={styles.actions}><button type="button" onClick={() => { setDraft({ reason: "" }); setModal({ kind: "REVOKE_GRANT", grant: row }); }}>Revoke access</button></div> : null}
    </article>)}{!data.grants.length ? <div className={styles.empty}>No physical-access grants in your authorised scope.</div> : null}</div> : null}

    {modal ? <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && setModal(undefined)}><form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>CONTROLLED ACTION</small><h3>{modal.kind.replaceAll("_", " ")}</h3></div><button type="button" onClick={() => setModal(undefined)} aria-label="Close"><X /></button></header>
      {modal.kind === "ISSUE" ? <><label>Identity<select required value={draft.user_id || ""} onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}><option value="">Select identity</option>{data.identities.filter((p) => p.status === "ACTIVE").map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id} · {p.job_title || "Office identity"}</option>)}</select></label><div className={styles.two}><label>Credential<select value={draft.kind || "DIGITAL_ID"} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}><option>DIGITAL_ID</option><option>NFC_CARD</option></select></label><label>Expiry<input type="datetime-local" value={draft.expires_at || ""} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} /></label></div></>
      : modal.kind === "POSTURE" ? <><label>OS version<input value={draft.os_version || ""} onChange={(e) => setDraft({ ...draft, os_version: e.target.value })} /></label><div className={styles.two}><label>Status<select value={draft.status || "UNKNOWN"} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{["COMPLIANT","DEGRADED","NON_COMPLIANT","UNKNOWN"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Source<select value={draft.source || "MANUAL_ATTESTATION"} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>{["MANUAL_ATTESTATION","MDM","EDR","KRAVIA_OFFICE","OTHER"].map((v) => <option key={v}>{v}</option>)}</select></label></div>{["encryption","screen_lock","security_agent","patch_current","firewall","compromise"].map((field) => <label key={field}>{field.replaceAll("_"," ")}<select value={draft[field] || "NO"} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}><option>YES</option><option>NO</option></select></label>)}</>
      : modal.kind === "ZONE" ? <><div className={styles.two}><label>Code<input required value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></label><label>Classification<select value={draft.classification || "INTERNAL"} onChange={(e) => setDraft({ ...draft, classification: e.target.value })}>{["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED","CRITICAL"].map((v) => <option key={v}>{v}</option>)}</select></label></div><label>Name<input required value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Description<textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label></>
      : modal.kind === "GRANT" ? <><label>Identity<select required value={draft.user_id || ""} onChange={(e) => setDraft({ ...draft, user_id: e.target.value, credential_id: "" })}><option value="">Select identity</option>{data.identities.filter((p) => p.status === "ACTIVE").map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id}</option>)}</select></label><label>Zone<select required value={draft.zone_id || ""} onChange={(e) => setDraft({ ...draft, zone_id: e.target.value })}><option value="">Select zone</option>{data.zones.filter((z) => z.active).map((z) => <option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>)}</select></label><label>Credential<select value={draft.credential_id || ""} onChange={(e) => setDraft({ ...draft, credential_id: e.target.value })}><option value="">No linked card</option>{data.credentials.filter((c) => c.user_id === draft.user_id && c.status === "ACTIVE").map((c) => <option key={c.id} value={c.id}>{c.credential_code} · {c.credential_kind}</option>)}</select></label><label>Access expiry<input type="datetime-local" value={draft.effective_to || ""} onChange={(e) => setDraft({ ...draft, effective_to: e.target.value })} /></label><label>Reason<textarea required minLength={3} maxLength={500} value={draft.reason || ""} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label></>
      : <label>Reason<textarea required minLength={3} maxLength={500} value={draft.reason || ""} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label>}
      <footer><button type="button" disabled={busy} onClick={() => setModal(undefined)}>Cancel</button><button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Confirm</button></footer>
    </form></div> : null}
  </section>;
}
