"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = { nextPath: string; configurationRequired?: boolean };

export function CorporateLoginForm({ nextPath, configurationRequired = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configurationRequired) return;
    setIsPending(true);
    setStatus(undefined);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setStatus("We could not sign you in with those details. Check your invitation-provisioned email and password.");
        return;
      }
      void fetch("/api/corporate/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType: "SIGNED_IN" }), keepalive: true });
      router.replace(nextPath);
      router.refresh();
    } catch {
      setStatus("Corporate Office sign-in is not available right now. Please try again shortly.");
    } finally {
      setIsPending(false);
    }
  }

  async function sendRecovery() {
    if (!email.trim() || configurationRequired) {
      setStatus("Enter your corporate email first to request a secure password reset link.");
      return;
    }
    setIsPending(true);
    setStatus(undefined);
    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/corporate/settings`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      setStatus(error ? "We could not start password recovery. Please try again shortly." : "If this email has an authorised account, a secure recovery link has been sent.");
    } catch {
      setStatus("We could not start password recovery. Please try again shortly.");
    } finally {
      setIsPending(false);
    }
  }

  return <form className="corporate-auth-form" onSubmit={signIn} noValidate>
    <div className="corporate-auth-icon" aria-hidden="true"><KeyRound /></div>
    <h2>Authorised access</h2>
    <p>Use the corporate email and password assigned to your invite-only Kravia account.</p>
    {configurationRequired ? <p className="office-config" role="alert">Corporate Office is not configured in this environment. No internal records are available.</p> : null}
    <label htmlFor="corporate-email">Corporate email
      <input id="corporate-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending || configurationRequired} />
    </label>
    <label htmlFor="corporate-password">Password
      <input id="corporate-password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending || configurationRequired} />
    </label>
    {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
    <button className="button button-dark corporate-auth-submit" type="submit" disabled={isPending || configurationRequired}>
      {isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />} Sign in securely
    </button>
    <button type="button" className="corporate-auth-recovery" onClick={sendRecovery} disabled={isPending || configurationRequired}>Forgot password?</button>
    <p className="corporate-auth-note">No public registration. If you need access, contact the Corporate Office administrator.</p>
  </form>;
}
