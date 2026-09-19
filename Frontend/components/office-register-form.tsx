"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./office-register-form.module.css";

type Props = {
  mode: "founder" | "invite";
  inviteToken?: string;
  email?: string;
  displayName?: string;
  roles?: string[];
};

async function json<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Request failed");
  return payload as T;
}

export function OfficeRegisterForm({ mode, inviteToken, email: presetEmail = "", displayName: presetName = "", roles = [] }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(presetEmail);
  const [displayName, setDisplayName] = useState(presetName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<"register" | "mfa">("register");
  const [qrCode, setQrCode] = useState<string>();
  const [manualKey, setManualKey] = useState<string>();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();

  const roleLabel = mode === "founder" ? "Founder" : roles.join(" · ");
  const strong =
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!strong) {
      setStatus("Use at least 12 characters with uppercase, lowercase, number and symbol.");
      return;
    }
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setPending(true);
    setStatus(undefined);
    try {
      await json("/api/office-auth/register", mode === "founder"
        ? { mode, email: email.trim(), display_name: displayName.trim(), password }
        : { mode, token: inviteToken, display_name: displayName.trim(), password });
      setPassword("");
      setConfirm("");
      const enrollment = await json<{ qr_code: string; manual_key: string }>("/api/office-auth/mfa", { action: "enroll" });
      setQrCode(enrollment.qr_code);
      setManualKey(enrollment.manual_key);
      setPhase("mfa");
      setStatus("Registration complete. Add the authenticator to finish activation.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setStatus("Enter the current 6-digit authenticator code.");
      return;
    }
    setPending(true);
    setStatus(undefined);
    try {
      await json("/api/office-auth/mfa", { action: "verify", code });
      router.replace("/office/dashboard");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authenticator verification failed.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "mfa") {
    return <form className={styles.form} onSubmit={verify}>
      <div className={styles.icon}><ShieldCheck /></div>
      <p className={styles.eyebrow}>FINAL ACTIVATION</p>
      <h2>Protect your account</h2>
      <p className={styles.intro}>Scan the QR code with your authenticator. Office access opens only after this step reaches AAL2.</p>
      {qrCode ? <div className={styles.qr}><Image src={qrCode} width={180} height={180} unoptimized alt="KRAVIA Office authenticator QR code" /></div> : null}
      {manualKey ? <div className={styles.manual}><span>Manual setup key</span><code>{manualKey}</code></div> : null}
      <label className={styles.field}>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0,6))} /></label>
      {status ? <p className={styles.status}>{status}</p> : null}
      <button className={styles.primary} disabled={pending}>{pending ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />} Verify and enter Office</button>
    </form>;
  }

  return <form className={styles.form} onSubmit={register}>
    <div className={styles.icon}><UserRoundPlus /></div>
    <p className={styles.eyebrow}>{mode === "founder" ? "ONE-TIME BOOTSTRAP" : "PRIVATE INVITATION"}</p>
    <h2>{mode === "founder" ? "Create Founder access" : "Create your Office identity"}</h2>
    <p className={styles.intro}>{mode === "founder" ? "This is the only public Office registration. It closes permanently after success." : "This registration is available only through the private link shared with you."}</p>

    <div className={styles.lockedRole}>
      <div><LockKeyhole /><span><small>Assigned identity</small><b>{roleLabel || "Assigned access"}</b></span></div>
      <em><Check /> Locked</em>
    </div>

    <label className={styles.field}>Full name<input required minLength={2} maxLength={160} autoComplete="name" placeholder="Your name" value={displayName} onChange={(event)=>setDisplayName(event.target.value)} /></label>
    <label className={styles.field}>Corporate email<input required type="email" autoComplete="email" readOnly={mode === "invite"} placeholder="name@kraviaprivatelimited.com" value={email} onChange={(event)=>setEmail(event.target.value)} /></label>
    <label className={styles.field}>Create password<div className={styles.passwordWrap}><input required type={showPassword ? "text":"password"} autoComplete="new-password" placeholder="Minimum 12 characters" value={password} onChange={(event)=>setPassword(event.target.value)} /><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
    <label className={styles.field}>Confirm password<input required type={showPassword ? "text":"password"} autoComplete="new-password" placeholder="Repeat password" value={confirm} onChange={(event)=>setConfirm(event.target.value)} /></label>

    <div className={styles.requirements} data-ready={strong}>
      <span>Password protection</span>
      <small>12+ characters · uppercase · lowercase · number · symbol</small>
    </div>

    {status ? <p className={styles.status}>{status}</p> : null}
    <button className={styles.primary} disabled={pending}>{pending?<LoaderCircle className={styles.spin}/>:<ArrowRight/>}{mode==="founder"?"Register Founder":"Complete registration"}</button>
    <p className={styles.note}>Already registered? <Link href="/office/login">Sign in to KRAVIA Office</Link></p>
  </form>;
}
