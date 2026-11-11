"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./office-register-form.module.css";

type InvitedEmailChallenge = {
  challenge_id: string;
  challenge_token: string;
  email: string;
  expires_at: string;
  resend_available_at: string;
};

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
  const [phase, setPhase] = useState<"register" | "mfa" | "email">("register");
  const [emailChallenge, setEmailChallenge] = useState<InvitedEmailChallenge>();
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
      if (mode === "invite") {
        setPhase("email");
        setStatus("Your account was created. Sending a one-time code to your registered corporate email…");
        try {
          const challenge = await json<InvitedEmailChallenge>("/api/office-auth/invited-email", { action: "request" });
          setEmailChallenge(challenge);
          setStatus("Verification code sent to " + challenge.email + ". Check your inbox.");
        } catch (emailError) {
          setStatus((emailError instanceof Error ? emailError.message : "Email delivery could not be confirmed.") + " Your account is saved. You can retry sending the code.");
        }
      } else {
        setPhase("mfa");
        setStatus("Registration complete. Activate KRAVIA Authenticator to continue.");
      }
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
      if (mode === "invite") {
        if (!emailChallenge) throw new Error("Request an email verification code first.");
        await json("/api/office-auth/invited-email", {
          action: "verify", challenge_id: emailChallenge.challenge_id,
          challenge_token: emailChallenge.challenge_token, code,
        });
      } else {
        await json("/api/office-auth/mfa", { action: "verify", code });
      }
      router.replace("/office/dashboard");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authenticator verification failed.");
    } finally {
      setPending(false);
    }
  }

  async function resendEmailOtp() {
    setPending(true);
    setStatus("Requesting a new email verification code…");
    try {
      const challenge = await json<InvitedEmailChallenge>("/api/office-auth/invited-email", { action: "request" });
      setEmailChallenge(challenge);
      setCode("");
      setStatus("A new code was sent to " + challenge.email + ". Previous codes will not work.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to resend the email verification code.");
    } finally {
      setPending(false);
    }
  }

  if (phase === "email") {
    return <form className={styles.form} onSubmit={verify}>
      <div className={styles.icon}><ShieldCheck /></div>
      <p className={styles.eyebrow}>EMAIL VERIFICATION</p>
      <h2>Check your corporate email</h2>
      <p className={styles.intro}>We send a single-use six-digit code to <b>{email || "your invited email address"}</b>. Enter that code below to complete your invited employee sign-in. No Authenticator setup is needed for this basic employee access.</p>
      <label className={styles.field}>Email verification code
        <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
          placeholder="6-digit code" maxLength={6} value={code}
          onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </label>
      {emailChallenge ? <p className={styles.note}>Code expires at {new Date(emailChallenge.expires_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. Maximum five attempts.</p> : null}
      {status ? <p className={styles.status} role="status">{status}</p> : null}
      <button className={styles.primary} type="submit" disabled={pending || !emailChallenge || code.length !== 6}>
        {pending ? <LoaderCircle className={styles.spin}/> : <ShieldCheck/>} Verify email and enter Office
      </button>
      <button className={styles.secondary} type="button" disabled={pending} onClick={() => void resendEmailOtp()}>
        {emailChallenge ? "Resend code to my email" : "Send email verification code"}
      </button>
      <p className={styles.note}>For privileged Office roles, an approved Authenticator factor is still required.</p>
      <p className={styles.note}>Already finished registration? <Link href="/office/login">Return to sign in</Link></p>
    </form>;
  }

  if (phase === "mfa") {
    return <form className={styles.form} onSubmit={verify}>
      <div className={styles.icon}><ShieldCheck /></div>
      <p className={styles.eyebrow}>FINAL ACTIVATION</p>
      <h2>Protect your account</h2>
      <p className={styles.intro}>Open Authenticator and sign in with your corporate credentials. A verified Office owner or administrator approves the phone before it can show a code. Office access opens only after this step reaches AAL2.</p>
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
