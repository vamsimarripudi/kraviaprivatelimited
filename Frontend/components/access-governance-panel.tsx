"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldAlert, UserPlus, UsersRound } from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import type { OfficeRole } from "@/lib/office/workspaces";
import styles from "./access-governance-panel.module.css";

type RoleCatalogRow = { role: OfficeRole; label: string; description: string; assignable_by_admin: boolean };
type DepartmentRow = { code: string; label: string; description: string };
type RoleGrant = { role: OfficeRole; expires_at?: string | null; grant_reason?: string | null; active: boolean };
type AccessStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
type AccessUser = {
  user_id: string;
  email?: string | null;
  last_sign_in_at?: string | null;
  status: AccessStatus;
  display_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  authorization_version: number;
  access_review_due_at?: string | null;
  roles: RoleGrant[];
};
type Invitation = { id: string; email: string; department?: string | null; requested_roles: OfficeRole[]; status: string; expires_at: string; created_at: string };
type AuditRow = { id: number; target_email?: string | null; action: string; role?: OfficeRole | null; created_at: string };
type AccessState = {
  actor: { userId: string; email?: string; roles: OfficeRole[] };
  users: AccessUser[];
  role_catalog: RoleCatalogRow[];
  departments: DepartmentRow[];
  invitations: Invitation[];
  audit: AuditRow[];
};
type InviteDraft = { email: string; display_name: string; job_title: string; department: string; roles: OfficeRole[]; reason: string };

const emptyInvite: InviteDraft = { email: "", display_name: "", job_title: "", department: "", roles: [], reason: "" };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Access-governance request failed");
  return payload as T;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function activeRoles(user: AccessUser) {
  return user.roles.filter((grant) => grant.active).map((grant) => grant.role);
}

export function AccessGovernancePanel({ identity }: { identity: OfficeIdentity }) {
  const [state, setState] = useState<AccessState>();
  const [loadError, setLoadError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean }>();
  const [invite, setInvite] = useState<InviteDraft>(emptyInvite);

  useEffect(() => {
    let mounted = true;
    void json<AccessState>("/api/office-access/users")
      .then((data) => { if (mounted) setState(data); })
      .catch((error: unknown) => { if (mounted) setLoadError(error instanceof Error ? error.message : "Unable to load access governance"); });
    return () => { mounted = false; };
  }, []);

  const owner = identity.roles.includes("OWNER");

  async function reload(message?: string) {
    const next = await json<AccessState>("/api/office-access/users");
    setState(next);
    if (message) setNotice({ message, error: false });
  }

  async function mutate(task: () => Promise<unknown>, success: string) {
    setPending(true);
    setNotice(undefined);
    try {
      await task();
      await reload(success);
      return true;
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Access change failed", error: true });
      return false;
    } finally {
      setPending(false);
    }
  }

  function toggleRole(role: OfficeRole) {
    setInvite((current) => ({
      ...current,
      roles: current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role],
    }));
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite.department || !invite.roles.length) {
      setNotice({ message: "Choose a department and at least one role.", error: true });
      return;
    }
    const ok = await mutate(
      () => json("/api/office-access/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          display_name: invite.display_name || undefined,
          job_title: invite.job_title || undefined,
          department: invite.department,
          roles: invite.roles,
          reason: invite.reason,
        }),
      }),
      "Invitation issued. The identity remains INVITED until the link is accepted, a strong password is set and authenticator MFA is verified.",
    );
    if (ok) setInvite(emptyInvite);
  }

  if (loadError) {
    return <section className={styles.state}><ShieldAlert /><div><h2>Access governance unavailable</h2><p>{loadError}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></section>;
  }
  if (!state) {
    return <section className={styles.state}><LoaderCircle className="spin" /><div><h2>Loading access governance</h2><p>Reading the authoritative Office identity and role registry.</p></div></section>;
  }

  const inviteRoles = state.role_catalog.filter((role) => role.role !== "OWNER" && (owner || role.assignable_by_admin));

  return <div className={styles.wrap}>
    <section className={styles.summary}>
      <div><p className="eyebrow">ACCESS AUTHORITY</p><h2>{owner ? "Owner-controlled delegation" : "Delegated administration"}</h2><p>{owner ? "Appoint ADMINs, directors and delegated professionals without allowing a second OWNER. The OWNER identity is protected from ordinary suspension, role removal, MFA reset and transfer." : "Onboard and manage delegated workforce/professional roles. ADMIN cannot alter itself, another ADMIN, a DIRECTOR or OWNER, and receives no business-data privilege automatically."}</p></div>
      <div className={styles.metrics}><article><span>Identities</span><strong>{state.users.length}</strong></article><article><span>Pending invitations</span><strong>{state.invitations.filter((item) => item.status === "PENDING").length}</strong></article><article><span>Your authority</span><strong>{identity.roles.join(" · ")}</strong></article></div>
    </section>

    {notice ? <div className={styles.notice} data-error={notice.error} role="status">{notice.error ? <ShieldAlert /> : <CheckCircle2 />}{notice.message}</div> : null}

    <section className={styles.panel}>
      <div className={styles.head}><div><p className="eyebrow">JOINER</p><h2>{owner ? "Appoint administrator or invite a team member" : "Invite an authorised team member"}</h2></div><UserPlus /></div>
      <form className={styles.form} onSubmit={submitInvite}>
        <label>Email<input required type="email" autoComplete="off" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></label>
        <label>Display name<input maxLength={120} value={invite.display_name} onChange={(event) => setInvite({ ...invite, display_name: event.target.value })} /></label>
        <label>Job title<input maxLength={120} value={invite.job_title} onChange={(event) => setInvite({ ...invite, job_title: event.target.value })} /></label>
        <label>Department<select required value={invite.department} onChange={(event) => setInvite({ ...invite, department: event.target.value })}><option value="">Select department</option>{state.departments.map((department) => <option key={department.code} value={department.code}>{department.label}</option>)}</select></label>
        <fieldset className={styles.roles}><legend>Roles</legend>{inviteRoles.map((role) => <label key={role.role}><input type="checkbox" checked={invite.roles.includes(role.role)} onChange={() => toggleRole(role.role)} /><span><b>{role.label}</b><small>{role.description}</small></span></label>)}</fieldset>
        <label className={styles.reason}>Business reason<textarea required minLength={3} maxLength={500} rows={3} value={invite.reason} onChange={(event) => setInvite({ ...invite, reason: event.target.value })} /></label>
        <button type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <UserPlus />} Issue controlled invite</button>
      </form>
    </section>

    <section className={styles.panel}>
      <div className={styles.head}><div><p className="eyebrow">JOINER · MOVER · LEAVER</p><h2>People and professional access</h2></div><button type="button" className={styles.iconButton} disabled={pending} onClick={() => void reload()} aria-label="Refresh access state"><RefreshCw /></button></div>
      <div className={styles.users}>{state.users.map((user) => <UserCard key={user.user_id} user={user} state={state} owner={owner} currentUserId={identity.userId} pending={pending} mutate={mutate} />)}</div>
    </section>

    <section className={styles.split}>
      <article className={styles.panel}><div className={styles.head}><div><p className="eyebrow">INVITATIONS</p><h2>Onboarding ledger</h2></div><UsersRound /></div><div className={styles.list}>{state.invitations.slice(0, 12).map((item) => <InviteRow key={item.id} item={item} owner={owner} pending={pending} mutate={mutate} />)}{!state.invitations.length ? <p>No invitations issued yet.</p> : null}</div></article>
      <article className={styles.panel}><div className={styles.head}><div><p className="eyebrow">IMMUTABLE AUDIT</p><h2>Latest access changes</h2></div><ShieldAlert /></div><div className={styles.audit}>{state.audit.slice(0, 16).map((item) => <div key={item.id}><time>{formatDate(item.created_at)}</time><b>{item.action.replaceAll("_", " ")}</b><span>{item.target_email ?? "Controlled identity"}{item.role ? ` · ${item.role}` : ""}</span></div>)}{!state.audit.length ? <p>No access changes recorded yet.</p> : null}</div></article>
    </section>
  </div>;
}

function UserCard({ user, state, owner, currentUserId, pending, mutate }: {
  user: AccessUser;
  state: AccessState;
  owner: boolean;
  currentUserId: string;
  pending: boolean;
  mutate: (task: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const roles = activeRoles(user);
  const privileged = roles.some((role) => ["OWNER", "DIRECTOR", "ADMIN"].includes(role));
  const lifecycleReady = user.status === "ACTIVE" || user.status === "SUSPENDED";
  const manageable = lifecycleReady && !roles.includes("OWNER") && (owner || (user.user_id !== currentUserId && !privileged));
  const roleOptions = state.role_catalog.filter((item) => item.role !== "OWNER" && (owner || item.assignable_by_admin));
  const [role, setRole] = useState<OfficeRole>(roleOptions[0]?.role ?? "MEMBER");
  const [department, setDepartment] = useState(user.department ?? state.departments[0]?.code ?? "OPERATIONS");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const reasonReady = reason.trim().length >= 3;

  async function post(url: string, body: Record<string, unknown>, success: string) {
    const ok = await mutate(() => json(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), success);
    if (ok) setReason("");
  }

  return <article className={styles.user}>
    <div className={styles.userHead}><div><b>{user.display_name || user.email || "Office identity"}</b><span>{user.job_title || user.email}</span><small>{user.department ?? "No department"} · authz v{user.authorization_version}</small></div><em data-status={user.status}>{user.status}</em></div>
    <div className={styles.badges}>{user.roles.map((grant) => <span key={grant.role} data-expired={!grant.active}>{grant.role}{grant.expires_at ? ` · until ${formatDate(grant.expires_at)}` : ""}</span>)}</div>
    <div className={styles.userMeta}><span>Last sign-in <b>{formatDate(user.last_sign_in_at)}</b></span><span>Access review due <b>{formatDate(user.access_review_due_at)}</b></span></div>
    {manageable ? <div className={styles.controls}>
      <label>Role<select value={role} onChange={(event) => setRole(event.target.value as OfficeRole)}>{roleOptions.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}</select></label>
      <label>Optional role expiry<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
      <label>Department<select value={department} onChange={(event) => setDepartment(event.target.value)}>{state.departments.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label className={styles.reason}>Reason / review note<input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <div className={styles.actions}>
        <button type="button" disabled={pending || !reasonReady} onClick={() => void post("/api/office-access/role", { target_user_id: user.user_id, role, action: "GRANT", expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined, reason }, `${role} granted.`)}>Grant role</button>
        <button type="button" disabled={pending || !reasonReady || !roles.includes(role)} onClick={() => void post("/api/office-access/role", { target_user_id: user.user_id, role, action: "REVOKE", reason }, `${role} revoked.`)}>Revoke role</button>
        <button type="button" disabled={pending || !reasonReady || department === user.department} onClick={() => void post("/api/office-access/department", { target_user_id: user.user_id, department, reason }, `Department changed to ${department}.`)}>Change department</button>
        {user.status === "ACTIVE" ? <button type="button" disabled={pending || !reasonReady} onClick={() => void post("/api/office-access/status", { target_user_id: user.user_id, status: "SUSPENDED", reason }, "Identity suspended.")}>Suspend</button> : <button type="button" disabled={pending || !reasonReady} onClick={() => void post("/api/office-access/status", { target_user_id: user.user_id, status: "ACTIVE", reason }, "Identity reactivated.")}>Reactivate</button>}
        <button type="button" disabled={pending || !reasonReady} onClick={() => void post("/api/office-access/status", { target_user_id: user.user_id, status: "REVOKED", reason }, "Identity revoked.")}>Revoke access</button>
        <button type="button" disabled={pending || !reasonReady} onClick={() => void post("/api/office-access/mfa-reset", { target_user_id: user.user_id, reason }, "Authenticator factors reset; the user must enroll MFA again.")}>Reset MFA</button>
        <button type="button" disabled={pending || user.user_id === currentUserId} onClick={() => void post("/api/office-access/review", { target_user_id: user.user_id, decision: "APPROVED", notes: reason || undefined }, "Access review approved.")}>Approve review</button>
        <button type="button" disabled={pending || user.user_id === currentUserId} onClick={() => void post("/api/office-access/review", { target_user_id: user.user_id, decision: "CHANGES_REQUIRED", notes: reason || undefined }, "Access review marked for changes.")}>Review changes</button>
      </div>
    </div> : <p className={styles.protected}>{user.status === "INVITED" ? "Pending invitation — no workspace access exists yet. Manage this identity through the invitation ledger until acceptance." : user.status === "REVOKED" ? "Revoked identity — ordinary role and lifecycle administration is permanently closed. Re-entry requires a new controlled onboarding decision." : roles.includes("OWNER") ? "Protected OWNER identity — ordinary administration cannot suspend, revoke, reset MFA or transfer this authority." : "This privileged identity is outside your delegated administration boundary."}</p>}
  </article>;
}

function InviteRow({ item, owner, pending, mutate }: {
  item: Invitation;
  owner: boolean;
  pending: boolean;
  mutate: (task: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const privileged = item.requested_roles.some((role) => ["ADMIN", "DIRECTOR", "OWNER"].includes(role));
  const canRevoke = item.status === "PENDING" && (owner || !privileged);

  async function revoke() {
    const ok = await mutate(() => json("/api/office-access/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: item.id, reason }),
    }), `Invitation for ${item.email} revoked.`);
    if (ok) setReason("");
  }

  return <div className={styles.inviteRow}><div><b>{item.email}</b><small>{item.requested_roles.join(" · ")} · {item.department ?? "Unassigned"}</small><small>Expires {formatDate(item.expires_at)}</small>{canRevoke ? <div className={styles.inviteControls}><input aria-label={`Reason to revoke invitation for ${item.email}`} placeholder="Revocation reason" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /><button type="button" disabled={pending || reason.trim().length < 3} onClick={() => void revoke()}>Revoke invite</button></div> : null}</div><span data-status={item.status}>{item.status}</span></div>;
}
