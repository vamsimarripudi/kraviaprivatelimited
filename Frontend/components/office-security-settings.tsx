"use client";

import { useEffect, useState } from "react";
import { Laptop, LoaderCircle, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
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
  risk_level: string;
  ip_address?: string | null;
  user_agent_summary?: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  device_id?: string | null;
  current: boolean;
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
        {!sessions ? <div className={styles.loading}><LoaderCircle className="spin" /> Loading sessions…</div> : sessions.length === 0 ? <div className={styles.empty}>No tracked Office sessions are available yet.</div> : <div className={styles.sessionList}>{sessions.map((session) => <article key={session.id} className={styles.session} data-current={session.current}>
          <div><b>{session.current ? "Current session" : session.status}</b><span>{session.aal.toUpperCase()} · {session.mfa_verified ? "MFA verified" : "MFA not verified"} · Risk {session.risk_level}</span></div>
          <small>Started {dateTime(session.started_at)} · Last seen {dateTime(session.last_seen_at)}</small>
          <small>{session.device_id ? "Linked to registered device" : "No trusted-device link"}{session.ip_address ? ` · Network ${session.ip_address}` : ""}</small>
          {session.user_agent_summary ? <code title={session.user_agent_summary}>{session.user_agent_summary}</code> : null}
        </article>)}</div>}
      </section>
    </div>

    <section className={styles.policy}>
      <ShieldCheck /><div><b>Security boundary</b><p>AAL2 proves the user completed MFA. Trusted-device binding separately proves that this browser possesses a secret bound to an administrator-approved, company-managed device. Authentication presence, device trust and business permissions remain independent controls.</p><small>Current session: {currentSession ? `${currentSession.aal.toUpperCase()} · ${currentSession.risk_level}` : "ledger pending"}</small></div>
    </section>
  </div>;
}
