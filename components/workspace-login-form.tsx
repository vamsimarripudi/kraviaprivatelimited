"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkspaceKind } from "@/lib/office/workspaces";

type SignInResponse = {
  authenticated: true;
  email?: string;
  roles: string[];
  access_status: string;
  aal: "aal1" | "aal2" | null;
  next_aal: "aal1" | "aal2" | null;
  mfa: { enrolled: boolean; factor_ids: string[] };
};

type Props = {
  workspace: WorkspaceKind;
  nextPath: string;
  configurationRequired?: boolean;
  reason?: string;
};

type Phase = "password" | "enroll" | "verify";

async function jsonRequest<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Request failed");
  return payload as T;
}

export function WorkspaceLoginForm({ workspace, nextPath, configurationRequired = false, reason }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("password");
  const [factorId, setFactorId] = useState<string>();
  const [challengeId, setChallengeId] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  const label = workspace === "finance" ? "KRAVIA FINANCE" : "KRAVIA OFFICE";

  async function finish() {
    router.replace(nextPath);
    router.refresh();
  }

  async function prepareMfa(auth: SignInResponse) {
    if (auth.aal === "aal2") {
      await finish();
      return;
    }

    if (auth.mfa.enrolled && auth.mfa.factor_ids[0]) {
      const id = auth.mfa.factor_ids[0];
      const challenge = await jsonRequest<{ challenge_id: string }>("/api/office-auth/mfa", { action: "challenge", factor_id: id });
      setFactorId(id);
      setChallengeId(challenge.challenge_id);
      setPhase("verify");
      setStatus("Enter the current code from your authenticator app.");
      return;
    }

    const enrolled = await jsonRequest<{ factor_id: string; qr_code: string }>("/api/office-auth/mfa", { action: "enroll" });
    setFactorId(enrolled.factor_id);
    setQrCode(enrolled.qr_code);
    setPhase("enroll");
    setStatus("Scan the QR code with your authenticator app, then enter the current code.");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configurationRequired) return;
    setIsPending(true);
    setStatus(undefined);
    try {
      const auth = await jsonRequest<SignInResponse>("/api/office-auth/sign-in", { email: email.trim(), password });
      setPassword("");
      await prepareMfa(auth);
    } catch {
      setStatus("Unable to sign in. Check your authorised corporate email and password.");
    } finally {
      setIsPending(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6,10}$/.test(code.trim())) {
      setStatus("Enter the current authenticator code.");
      return;
    }
    setIsPending(true);
    setStatus(undefined);
    try {
      let activeChallenge = challengeId;
      if (!activeChallenge) {
        const challenge = await jsonRequest<{ challenge_id: string }>("/api/office-auth/mfa", { action: "challenge", factor_id: factorId });
        activeChallenge = challenge.challenge_id;
        setChallengeId(activeChallenge);
      }
      await jsonRequest<{ verified: true; aal: "aal2" }>("/api/office-auth/mfa", {
        action: "verify",
        factor_id: factorId,
        challenge_id: activeChallenge,
        code: code.trim(),
      });
      setCode("");
      await finish();
    } catch {
      setStatus("The authenticator code was not accepted. Use the current code and try again.");
    } finally {
      setIsPending(false);
    }
  }

  if (phase === "enroll" || phase === "verify") {
    return <form className="corporate-auth-form" onSubmit={verifyMfa} noValidate>
      <div className="corporate-auth-icon" aria-hidden="true"><ShieldCheck /></div>
      <p className="eyebrow">MANDATORY MFA</p>
      <h2>{phase === "enroll" ? "Secure your account" : "Verify your identity"}</h2>
      {phase === "enroll" && qrCode ? <div className="workspace-mfa-qr"><Image src={qrCode} width={220} height={220} unoptimized alt="KRAVIA Office authenticator enrollment QR code" /></div> : null}
      <p>{phase === "enroll" ? "Use a TOTP authenticator such as Google Authenticator, Microsoft Authenticator, 1Password or Apple Passwords." : "Your password session is valid, but this workspace requires an AAL2 session before access is granted."}</p>
      <label htmlFor="workspace-mfa-code">Authenticator code
        <input id="workspace-mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))} disabled={isPending} />
      </label>
      {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
      <button className="button button-dark corporate-auth-submit" type="submit" disabled={isPending}>
        {isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />} Verify and continue
      </button>
      <p className="corporate-auth-note">The authenticator secret and verification code are never stored by the KRAVIA website.</p>
    </form>;
  }

  return <form className="corporate-auth-form" onSubmit={signIn} noValidate>
    <div className="corporate-auth-icon" aria-hidden="true"><KeyRound /></div>
    <p className="eyebrow">{label}</p>
    <h2>Authorised access</h2>
    <p>Use the personal company identity assigned to you. Public registration is disabled.</p>
    {configurationRequired ? <p className="office-config" role="alert">Internal identity configuration is not active on this deployment.</p> : null}
    {reason === "mfa_required" ? <p className="office-config" role="status">Your session needs multi-factor verification before this workspace can open.</p> : null}
    {reason === "workspace_forbidden" ? <p className="office-config" role="alert">Your assigned role does not grant access to this workspace.</p> : null}
    <label htmlFor={`${workspace}-email`}>Corporate email
      <input id={`${workspace}-email`} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending || configurationRequired} />
    </label>
    <label htmlFor={`${workspace}-password`}>Password
      <input id={`${workspace}-password`} type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending || configurationRequired} />
    </label>
    {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
    <button className="button button-dark corporate-auth-submit" type="submit" disabled={isPending || configurationRequired}>
      {isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />} Sign in securely
    </button>
    <p className="corporate-auth-note">Password recovery remains administrator-controlled until the production recovery/SMTP policy is activated.</p>
  </form>;
}
