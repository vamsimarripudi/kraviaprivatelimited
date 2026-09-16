"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type Phase = "password" | "mfa";

async function jsonRequest<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Activation request failed");
  return payload as T;
}

function strongPassword(password: string) {
  return password.length >= 14 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export function WorkspaceActivationForm({ email, nextPath }: { email?: string; nextPath: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("password");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [factorId, setFactorId] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();

  async function savePassword(event: FormEvent<HTMLFormElement>) {
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
      await jsonRequest("/api/office-auth/password", { password });
      setPassword("");
      setConfirmPassword("");
      const enrolled = await jsonRequest<{ factor_id: string; qr_code: string }>("/api/office-auth/mfa", { action: "enroll" });
      setFactorId(enrolled.factor_id);
      setQrCode(enrolled.qr_code);
      setPhase("mfa");
      setStatus("Password secured. Scan the QR code and verify the current authenticator code.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account activation failed.");
    } finally {
      setPending(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6,10}$/.test(code.trim())) {
      setStatus("Enter the current authenticator code.");
      return;
    }
    setPending(true);
    setStatus(undefined);
    try {
      const challenge = await jsonRequest<{ challenge_id: string }>("/api/office-auth/mfa", { action: "challenge", factor_id: factorId });
      await jsonRequest("/api/office-auth/mfa", { action: "verify", factor_id: factorId, challenge_id: challenge.challenge_id, code: code.trim() });
      setCode("");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authenticator verification failed.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "mfa") {
    return <form className="corporate-auth-form" onSubmit={verifyMfa} noValidate>
      <div className="corporate-auth-icon"><ShieldCheck /></div><p className="eyebrow">MANDATORY MFA</p><h2>Protect your Office identity</h2>
      {qrCode ? <div className="workspace-mfa-qr"><Image src={qrCode} width={220} height={220} unoptimized alt="KRAVIA Office authenticator enrollment QR code" /></div> : null}
      <p>Scan this once with your authenticator app. KRAVIA does not store the authenticator secret in the website or source repository.</p>
      <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))} disabled={pending} /></label>
      {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
      <button className="button button-dark corporate-auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <ShieldCheck />} Verify and enter workspace</button>
    </form>;
  }

  return <form className="corporate-auth-form" onSubmit={savePassword} noValidate>
    <div className="corporate-auth-icon"><KeyRound /></div><p className="eyebrow">INVITE ACCEPTED</p><h2>Activate your KRAVIA Office account</h2>
    <p>{email ? `Identity: ${email}. ` : ""}Choose a unique password. Workspace access remains blocked until authenticator MFA is verified.</p>
    <label>New password<input type="password" autoComplete="new-password" minLength={14} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} /></label>
    <label>Confirm password<input type="password" autoComplete="new-password" minLength={14} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={pending} /></label>
    <p className="corporate-auth-note">Minimum 14 characters with uppercase, lowercase, number and symbol. Use a password manager and do not reuse this password elsewhere.</p>
    {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
    <button className="button button-dark corporate-auth-submit" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <ShieldCheck />} Secure account and continue</button>
  </form>;
}
