"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./workspace-login-form.module.css";

export function OfficeFounderRecoveryForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(undefined);
    try {
      const response = await fetch("/api/office-auth/recovery/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ recovery_key: key, reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Founder recovery failed");
      setKey("");
      setReason("");
      if (typeof body.recovery_url !== "string" || !body.recovery_url.startsWith("/office/reset-password?token=")) {
        throw new Error("Founder recovery returned an invalid reset path");
      }
      router.replace(body.recovery_url);
    } catch (error) {
      setKey("");
      setStatus(error instanceof Error ? error.message : "Founder recovery failed");
    } finally {
      setPending(false);
    }
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <div className={styles.icon}><ShieldAlert /></div>
    <p className={styles.eyebrow}>FOUNDER BREAK-GLASS</p>
    <h2>Recover the protected Founder identity</h2>
    <p className={styles.intro}>Use only the offline KRAVIA break-glass secret. A successful request revokes active Founder sessions and resets MFA before issuing a short-lived single-use password link.</p>

    <label className={styles.field} htmlFor="founder-recovery-key">
      <span>Break-glass recovery secret</span>
      <input
        id="founder-recovery-key"
        type="password"
        autoComplete="off"
        minLength={48}
        maxLength={512}
        required
        value={key}
        onChange={(event) => setKey(event.target.value)}
        disabled={pending}
      />
    </label>

    <label className={styles.field} htmlFor="founder-recovery-reason">
      <span>Recovery reason</span>
      <input
        id="founder-recovery-reason"
        type="text"
        autoComplete="off"
        minLength={3}
        maxLength={500}
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={pending}
      />
    </label>

    {status ? <p className={styles.status} role="status">{status}</p> : null}

    <button className={styles.primary} type="submit" disabled={pending || key.length < 48 || reason.trim().length < 3}>
      {pending ? <LoaderCircle className={styles.spin} /> : <KeyRound />}
      Issue Founder recovery
    </button>
    <p className={styles.note}>The break-glass secret is sent only for this same-origin request and is never written to Office records.</p>
  </form>;
}
