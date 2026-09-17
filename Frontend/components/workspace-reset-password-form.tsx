"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

function strongPassword(password: string) {
  return password.length >= 14 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export function WorkspaceResetPasswordForm({ email }: { email?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!strongPassword(password)) {
      setStatus("Use at least 14 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }
    if (password !== confirmPassword) {
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
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Password reset failed");
      setPassword("");
      setConfirmPassword("");
      router.replace("/office/login?reason=password_reset");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="corporate-auth-form" onSubmit={submit} noValidate>
      <div className="corporate-auth-icon"><KeyRound /></div>
      <p className="eyebrow">VERIFIED RECOVERY SESSION</p>
      <h2>Set a new Office password</h2>
      <p>{email ? `Identity: ${email}. ` : ""}Choose a unique password. Your existing authenticator factor is not removed by password recovery.</p>
      <label>New password<input type="password" autoComplete="new-password" minLength={14} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" minLength={14} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={pending} /></label>
      <p className="corporate-auth-note">Minimum 14 characters with uppercase, lowercase, number and symbol. After reset, all Office refresh sessions are revoked and you must sign in again.</p>
      {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
      <button className="button button-dark corporate-auth-submit" type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" /> : <ShieldCheck />} Update password securely
      </button>
    </form>
  );
}
