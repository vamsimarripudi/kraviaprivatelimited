"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Laptop, LoaderCircle, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import styles from "./office-security-settings.module.css";

type Device = {
  id: string;
  device_label: string;
  device_kind: string;
  platform?: string | null;
  trust_state: string;
  company_managed: boolean;
  approved_at?: string | null;
  revoked_at?: string | null;
  last_seen_at?: string | null;
  bound_at?: string | null;
  current: boolean;
};

type AuthSession = {
  id: string;
  status: string;
  aal: string;
  mfa_verified: boolean;
  ip_address?: string | null;
  user_agent_hash?: string | null;
  started_at?: string | null;
  last_seen_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  current: boolean;
  provider: "KRAVIA_FIRST_PARTY";
};

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Security request failed");
  return body as T;
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function OfficeSecuritySettings({ identity }: { identity: OfficeIdentity }) {
  const [devices, setDevices] = useState<Device[]>();
  const [sessions, setSessions] = useState<AuthSession[]>();
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function reload() {
    const [deviceData, sessionData] = await Promise.all([
      json<{ devices: Device[] }>("/api/office-auth/device"),
      json<{ sessions: AuthSession[] }>("/api/office-auth/sessions"),
    ]);
    setDevices(deviceData.devices);
    setSessions(sessionData.sessions);
  }

  useEffect(() => {
    let alive = true;
    void Promise.all([
      json<{ devices: Device[] }>("/api/office-auth/device"),
      json<{ sessions: AuthSession[] }>("/api/office-auth/sessions"),
    ]).then(([deviceData, sessionData]) => {
      if (!alive) return;
      setDevices(deviceData.devices);
      setSessions(sessionData.sessions);
    }).catch((caught: unknown) => {
      if (alive) setError(caught instanceof Error ? caught.message : "Unable to load Office security state");
    });
    return () => { alive = false; };
  }, []);

  async function bind(deviceId: string) {
    setBusyId(deviceId);
    setError(undefined);
    setNotice(undefined);
    try {
      await json("/api/office-auth/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId }),
      });
      await reload();
      setNotice("This browser is now cryptographically bound to the approved company device.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to bind this browser");
    } finally {
      setBusyId(undefined);
    }
  }

  async function unbind() {
    setBusyId("current");
    setError(undefined);
    setNotice(undefined);
    try {
      await json("/api/office-auth/device", { method: "DELETE" });
      await reload();
      setNotice("This browser is no longer bound to a trusted device.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to unbind this browser");
    } finally {
      setBusyId(undefined);
    }
  }

  async function revokeSession(sessionId: string) {
    setBusyId(`session:${sessionId}`);
    setError(undefined);
    setNotice(undefined);
    try {
      await json("/api/office-auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      await reload();
      setNotice("The selected Office session has been revoked.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke Office session");
    } finally {
      setBusyId(undefined);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    if (newPassword !== confirmPassword) {
      setError("The new-password confirmation does not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await json<{ changed: true; revoked_other_sessions: number }>("/api/office-auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(`Password changed. ${result.revoked_other_sessions} other session(s) were revoked.`);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change password");
    } finally {
      setPasswordBusy(false);
    }
  }

  const currentDevice = devices?.find((device) => device.current);
  const currentSession = sessions?.find((session) => session.current);

  return <div className={styles.shell}>
    <section className={styles.hero}>
      <div><p>IDENTITY SECURITY</p><h2>Session, MFA and trusted-device control.</h2><span>{identity.email ?? "Verified Office identity"} · {identity.roles.join(" · ")} · {identity.aal.toUpperCase()}</span></div>
      <div className={styles.posture} data-ready={Boolean(currentDevice)}><ShieldCheck /><div><b>{currentDevice ? "Trusted browser" : "AAL2 verified"}</b><small>{currentDevice ? currentDevice.device_label : "Bind an approved company-managed device before strict device enforcement is enabled."}</small></div></div>
    </section>

    {error ? <div className={styles.error}><ShieldOff />{error}</div> : null}
    {notice ? <div className={styles.notice}><ShieldCheck />{notice}</div> : null}

    <div className={styles.grid}>
      <section className={styles.panel}>
        <header><div><p>TRUSTED DEVICES</p><h3>Registered company devices</h3></div><MonitorSmartphone /></header>
        {!devices ? <div className={styles.loading}><LoaderCircle className="spin" /> Loading devices…</div> : devices.length === 0 ? <div className={styles.empty}>No device has been registered for this identity. An Office access administrator must register and approve a company-managed device first.</div> : <div className={styles.rows}>{devices.map((device) => {
          const eligible = device.trust_state === "TRUSTED" && device.company_managed && !device.revoked_at;
          return <article key={device.id} className={styles.device} data-current={device.current}>
            <div className={styles.deviceIcon}><Laptop /></div>
            <div className={styles.deviceCopy}><div><b>{device.device_label}</b>{device.current ? <em>CURRENT</em> : null}</div><span>{device.device_kind}{device.platform ? ` · ${device.platform}` : ""}</span><small>{device.trust_state} · {device.company_managed ? "Company managed" : "Not company managed"} · Last seen {dateTime(device.last_seen_at)}</small></div>
            <div className={styles.deviceAction}>{device.current ? <button type="button" disabled={Boolean(busyId)} onClick={() => void unbind()}>{busyId === "current" ? <LoaderCircle className="spin" /> : null} Unbind browser</button> : eligible ? <button className={styles.primary} type="button" disabled={Boolean(busyId)} onClick={() => void bind(device.id)}>{busyId === device.id ? <LoaderCircle className="spin" /> : null} Bind this browser</button> : <span>Approval required</span>}</div>
          </article>;
        })}</div>}
      </section>

      <section className={styles.panel}>
        <header><div><p>AUTHENTICATION LEDGER</p><h3>Recent Office sessions</h3></div><ShieldCheck /></header>
        {!sessions ? <div className={styles.loading}><LoaderCircle className="spin" /> Loading sessions…</div> : sessions.length === 0 ? <div className={styles.empty}>No first-party Office sessions are available.</div> : <div className={styles.sessionList}>{sessions.map((session) => <article key={session.id} className={styles.session} data-current={session.current}>
          <div>
            <div><b>{session.current ? "Current session" : session.status}</b><span>{session.aal.toUpperCase()} · {session.mfa_verified ? "MFA verified" : "MFA not verified"} · KRAVIA first-party</span></div>
            {!session.current && session.status === "ACTIVE" ? <button className={styles.sessionAction} type="button" disabled={Boolean(busyId)} onClick={() => void revokeSession(session.id)}>{busyId === `session:${session.id}` ? <LoaderCircle className="spin" /> : null} Revoke</button> : null}
          </div>
          <small>Started {dateTime(session.started_at)} · Last seen {dateTime(session.last_seen_at)} · Expires {dateTime(session.expires_at)}</small>
          <small>{session.ip_address ? `Network ${session.ip_address}` : "Network metadata unavailable"}{session.revoked_at ? ` · Revoked ${dateTime(session.revoked_at)}` : ""}</small>
          {session.user_agent_hash ? <code title={session.user_agent_hash}>Device fingerprint {session.user_agent_hash.slice(0, 16)}…</code> : null}
        </article>)}</div>}
      </section>
    </div>

    <section className={styles.passwordPanel}>
      <header><div><p>PASSWORD SECURITY</p><h3>Change your KRAVIA Office password</h3></div><KeyRound /></header>
      <form className={styles.passwordForm} onSubmit={changePassword}>
        <label>Current password<input type="password" autoComplete="current-password" required maxLength={256} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={passwordBusy} /></label>
        <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={passwordBusy} /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={passwordBusy} /></label>
        <button type="submit" disabled={passwordBusy || currentPassword.length === 0 || newPassword.length < 12 || confirmPassword.length < 12}>{passwordBusy ? <LoaderCircle className="spin" /> : <KeyRound />} Change password</button>
      </form>
      <small>Changing your password keeps this verified session active and revokes every other active Office session.</small>
    </section>

    <section className={styles.policy}>
      <ShieldCheck /><div><b>Security boundary</b><p>AAL2 proves the user completed MFA. Trusted-device binding separately proves that this browser possesses a secret bound to an administrator-approved, company-managed device. Authentication presence, device trust and business permissions remain independent controls.</p><small>Current session: {currentSession ? `${currentSession.aal.toUpperCase()} · KRAVIA first-party` : "session evidence unavailable"}</small></div>
    </section>
  </div>;
}
