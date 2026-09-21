"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import styles from "./workspace-login-form.module.css";

export function OfficePasswordRecoveryForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/office/reset-password");
  }, []);
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setStatus("The password confirmation does not match.");
      return;
    }
    setPending(true);
    setStatus(undefined);
    try {
      const response = await fetch("/api/office-auth/recovery/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ token, new_password: password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Password recovery failed");
      setPassword("");
      setConfirm("");
      setComplete(true);
      setStatus("Password updated. All previous Office sessions were revoked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password recovery failed.");
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return <div className={styles.form}>
      <div className={styles.icon}><ShieldCheck /></div>
      <p className={styles.eyebrow}>RECOVERY COMPLETE</p>
      <h2>Office access restored</h2>
      <p className={styles.intro}>Your password has been replaced and previous sessions were revoked. Sign in again and complete MFA.</p>
      {status ? <p className={styles.alert} role="status">{status}</p> : null}
      <Link className={styles.primary} href="/office/login">Sign in to KRAVIA Office</Link>
      <p className={styles.note}>This recovery link can no longer be used.</p>
    </div>;
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <div className={styles.icon}><KeyRound /></div>
    <p className={styles.eyebrow}>PRIVATE RECOVERY LINK</p>
    <h2>Set a new Office password</h2>
    <p className={styles.intro}>Use a new password with at least 12 characters, uppercase, lowercase, a number and a symbol.</p>

    <label className={styles.field} htmlFor="office-recovery-password">
      <span>New password</span>
      <div className={styles.passwordWrap}>
        <input
          id="office-recovery-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
        <button type="button" className={styles.eye} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
          {showPassword ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </label>

    <label className={styles.field} htmlFor="office-recovery-confirm">
      <span>Confirm new password</span>
      <input
        id="office-recovery-confirm"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={256}
        required
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        disabled={pending}
      />
    </label>

    {status ? <p className={styles.status} role="status">{status}</p> : null}

    <button className={styles.primary} type="submit" disabled={pending || password.length < 12 || confirm.length < 12}>
      {pending ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />}
      Replace password
    </button>
    <p className={styles.note}>The token is single-use because validity is bound to the current password version.</p>
  </form>;
}
