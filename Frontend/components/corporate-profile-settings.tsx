"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = { email: string; fullName: string; role: string | null };
type Feedback = { tone: "success" | "error"; message: string } | undefined;
type MfaEnrollment = { factorId: string; qrCode: string; secret: string } | undefined;

export function CorporateProfileSettings({ email, fullName: initialFullName, role }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaState, setMfaState] = useState<"loading" | "enabled" | "not_enabled" | "unavailable">("loading");
  const [pending, setPending] = useState<"profile" | "password" | "mfa" | "signout" | undefined>();
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment>();
  const [mfaCode, setMfaCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback>();

  useEffect(() => {
    let active = true;
    async function loadMfa() {
      try {
        const { data, error } = await createBrowserSupabaseClient().auth.mfa.listFactors();
        if (!active) return;
        setMfaState(error ? "unavailable" : (data?.totp?.length ? "enabled" : "not_enabled"));
      } catch { if (active) setMfaState("unavailable"); }
    }
    void loadMfa();
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("profile"); setFeedback(undefined);
    try {
      const { error } = await createBrowserSupabaseClient().auth.updateUser({ data: { full_name: fullName.trim() || null } });
      setFeedback(error ? { tone: "error", message: "Your profile could not be updated. Please try again." } : { tone: "success", message: "Your profile details have been saved." });
      if (!error) router.refresh();
    } catch { setFeedback({ tone: "error", message: "Your profile could not be updated. Please try again." }); }
    finally { setPending(undefined); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 12) { setFeedback({ tone: "error", message: "Use a password of at least 12 characters." }); return; }
    if (newPassword !== confirmPassword) { setFeedback({ tone: "error", message: "Your new password entries do not match." }); return; }
    setPending("password"); setFeedback(undefined);
    try {
      const supabase = createBrowserSupabaseClient();
      const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (check.error) { setFeedback({ tone: "error", message: "Your current password could not be verified." }); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setFeedback({ tone: "error", message: "Your password could not be changed. Please try again." }); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setFeedback({ tone: "success", message: "Your password has been changed." });
    } catch { setFeedback({ tone: "error", message: "Your password could not be changed. Please try again." }); }
    finally { setPending(undefined); }
  }

  async function startMfaEnrollment() {
    setPending("mfa"); setFeedback(undefined);
    try {
      const { data, error } = await createBrowserSupabaseClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "Kravia Corporate Office" });
      if (error || !data?.totp?.qr_code) { setFeedback({ tone: "error", message: "MFA setup could not be started. Please try again." }); return; }
      setMfaEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setFeedback({ tone: "success", message: "Scan the QR code with your authenticator app, then enter its six-digit code." });
    } catch { setFeedback({ tone: "error", message: "MFA setup could not be started. Please try again." }); }
    finally { setPending(undefined); }
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaEnrollment || !/^\d{6}$/.test(mfaCode)) { setFeedback({ tone: "error", message: "Enter the six-digit code from your authenticator app." }); return; }
    setPending("mfa"); setFeedback(undefined);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollment.factorId });
      if (challengeError || !challenge) { setFeedback({ tone: "error", message: "MFA verification could not be started. Please try again." }); return; }
      const { error } = await supabase.auth.mfa.verify({ factorId: mfaEnrollment.factorId, challengeId: challenge.id, code: mfaCode });
      if (error) { setFeedback({ tone: "error", message: "That verification code is not valid. Try a new code from your authenticator app." }); return; }
      setMfaEnrollment(undefined); setMfaCode(""); setMfaState("enabled");
      setFeedback({ tone: "success", message: "Multi-factor authentication is now enabled for this account." });
      router.refresh();
    } catch { setFeedback({ tone: "error", message: "MFA verification could not be completed. Please try again." }); }
    finally { setPending(undefined); }
  }
  async function signOutEverywhere() {
    setPending("signout"); setFeedback(undefined);
    try {
      await createBrowserSupabaseClient().auth.signOut({ scope: "global" });
      router.replace("/corporate/login"); router.refresh();
    } catch { setFeedback({ tone: "error", message: "We could not sign out all sessions. Please try again." }); setPending(undefined); }
  }

  return <main className="profile-settings"><Link href="/corporate/dashboard" className="profile-back">← Corporate overview</Link><header><div><p className="eyebrow">CORPORATE OFFICE / SETTINGS</p><h1>Profile &amp; <em>security</em></h1><p>Manage your own account details and security. Corporate roles and access remain controlled by authorised administrators.</p></div><div className="profile-role"><UserRound aria-hidden="true" /><span>{role?.replaceAll("_", " ") ?? "NO CORPORATE ROLE"}</span></div></header>
    {feedback ? <p className={`profile-feedback ${feedback.tone}`} role="status">{feedback.tone === "success" ? <CheckCircle2 aria-hidden="true" /> : null}{feedback.message}</p> : null}
    <div className="profile-settings-grid">
      <section className="profile-panel"><div className="profile-panel-heading"><UserRound aria-hidden="true" /><div><p className="eyebrow">IDENTITY</p><h2>Your profile</h2></div></div><form onSubmit={saveProfile}><label htmlFor="profile-name">Display name<input id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={120} disabled={Boolean(pending)} /></label><label htmlFor="profile-email">Corporate email<input id="profile-email" value={email} readOnly aria-readonly="true" /></label><p className="profile-note">Email and role changes require the Corporate Office access process.</p><button className="button button-dark" disabled={Boolean(pending)}>{pending === "profile" ? <LoaderCircle className="spin" aria-hidden="true" /> : null}Save profile</button></form></section>
      <section className="profile-panel"><div className="profile-panel-heading"><ShieldCheck aria-hidden="true" /><div><p className="eyebrow">ASSURANCE</p><h2>Multi-factor authentication</h2></div></div><p>{mfaState === "loading" ? "Checking your MFA status…" : mfaState === "enabled" ? "MFA is enabled for this account." : mfaState === "not_enabled" ? "MFA is not enrolled on this account. Privileged actions will require it." : "MFA status is temporarily unavailable."}</p>{mfaState === "not_enabled" && !mfaEnrollment ? <button className="button button-dark" type="button" onClick={startMfaEnrollment} disabled={Boolean(pending)}>{pending === "mfa" ? <LoaderCircle className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}Set up MFA</button> : null}{mfaEnrollment ? <form className="mfa-enrollment" onSubmit={verifyMfaEnrollment}><Image src={mfaEnrollment.qrCode} alt="Scan this QR code with your authenticator app" width={176} height={176} unoptimized /><p className="profile-note">If you cannot scan it, add this setup key manually: <code>{mfaEnrollment.secret}</code></p><label htmlFor="mfa-code">Authenticator code<input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} required disabled={pending === "mfa"} /></label><button className="button button-dark" disabled={pending === "mfa"}>{pending === "mfa" ? <LoaderCircle className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}Verify and enable MFA</button></form> : null}<p className="profile-note">MFA removal and role changes require an authorised Corporate Office security review.</p></section>
      <section className="profile-panel"><div className="profile-panel-heading"><KeyRound aria-hidden="true" /><div><p className="eyebrow">CREDENTIAL</p><h2>Change password</h2></div></div><form onSubmit={changePassword}><label htmlFor="current-password">Current password<input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={Boolean(pending)} /></label><label htmlFor="new-password">New password<input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} disabled={Boolean(pending)} /></label><label htmlFor="confirm-password">Confirm new password<input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} disabled={Boolean(pending)} /></label><button className="button button-dark" disabled={Boolean(pending)}>{pending === "password" ? <LoaderCircle className="spin" aria-hidden="true" /> : null}Update password</button></form></section>
      <section className="profile-panel profile-danger"><div className="profile-panel-heading"><LogOut aria-hidden="true" /><div><p className="eyebrow">SESSIONS</p><h2>Sign out everywhere</h2></div></div><p>End this account’s active sessions across devices. You will need to sign in again.</p><button className="profile-signout" type="button" onClick={signOutEverywhere} disabled={Boolean(pending)}>{pending === "signout" ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}Sign out all sessions</button></section>
    </div>
  </main>;
}
