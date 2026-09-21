"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { preferredLandingPath, type OfficeRole, type WorkspaceKind } from "@/lib/office/workspaces";
import styles from "./workspace-login-form.module.css";

type SignInResponse = {
  authenticated: true;
  email?: string;
  roles: string[];
  access_status: string;
  aal: "aal1" | "aal2" | null;
  next_aal: "aal1" | "aal2" | null;
  founder?: boolean;
  display_role?: string;
  mfa: { enrolled: boolean; factor_ids: string[] };
};
type Props = {
  workspace: WorkspaceKind;
  nextPath: string;
  configurationRequired?: boolean;
  reason?: string;
  registrationOpen?: boolean;
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

export function WorkspaceLoginForm({
  workspace,
  nextPath,
  configurationRequired = false,
  reason,
  registrationOpen = false,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("password");
  const [qrCode, setQrCode] = useState<string>();
  const [manualKey, setManualKey] = useState<string>();
  const [showManualKey, setShowManualKey] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const [destination, setDestination] = useState(nextPath);

  async function finish(path = destination) {
    router.replace(path);
    router.refresh();
  }

  async function prepareMfa(auth: SignInResponse) {
    const validRoles = auth.roles.filter((role): role is OfficeRole =>
      ["OWNER", "DIRECTOR", "ADMIN", "MEMBER", "FINANCE", "CA", "CS", "LEGAL", "HR", "OPERATIONS", "AUDITOR", "PRODUCT_ADMIN"].includes(role)
    );
    const defaultPath = preferredLandingPath(validRoles);
    const selected = nextPath === "/office/dashboard" || nextPath === "/finance/dashboard" ? defaultPath : nextPath;
    setDestination(selected);

    if (auth.aal === "aal2") {
      await finish(selected);
      return;
    }

    if (auth.mfa.enrolled) {
      setPhase("verify");
      setStatus("Open KRAVIA Authenticator and enter the current 6-digit code.");
      return;
    }

    const enrolled = await jsonRequest<{ factor_id: string; qr_code: string; manual_key: string; friendly_name: "KRAVIA Authenticator"; required_for_all_roles: true }>("/api/office-auth/mfa", { action: "enroll" });
    setQrCode(enrolled.qr_code);
    setManualKey(enrolled.manual_key);
    setShowManualKey(false);
    setPhase("enroll");
    setStatus("Open KRAVIA Authenticator, scan this QR code, then enter the current 6-digit code.");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configurationRequired) return;
    setIsPending(true);
    setStatus(undefined);
    try {
      const auth = await jsonRequest<SignInResponse>("/api/office-auth/sign-in", {
        email: email.trim(),
        password,
      });
      setPassword("");
      await prepareMfa(auth);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsPending(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setStatus("Enter the current 6-digit code from KRAVIA Authenticator.");
      return;
    }
    setIsPending(true);
    setStatus(undefined);
    try {
      await jsonRequest<{ verified: true; aal: "aal2" }>("/api/office-auth/mfa", {
        action: "verify",
        code: code.trim(),
      });
      setCode("");
      await finish();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The authenticator code was not accepted.");
    } finally {
      setIsPending(false);
    }
  }

  if (phase === "enroll" || phase === "verify") {
    return (
      <form className={styles.form} onSubmit={verifyMfa} noValidate>
        <div className={styles.icon}><ShieldCheck /></div>
        <p className={styles.eyebrow}>MANDATORY MFA</p>
        <h2>{phase === "enroll" ? "Secure your account" : "Verify your identity"}</h2>
        <p className={styles.intro}>
          {phase === "enroll"
            ? "KRAVIA Authenticator is required for every Office role. Install/open the KRAVIA app and scan this enrollment code."
            : "Your password is correct. Complete the second factor to continue."}
        </p>

        {phase === "enroll" && qrCode ? (
          <div className={styles.qrWrap}>
            <Image src={qrCode} width={188} height={188} unoptimized alt="KRAVIA Office authenticator QR code" />
          </div>
        ) : null}

        {phase === "enroll" && manualKey ? (
          showManualKey ? (
            <div className={styles.manualKey}>
              <span>KRAVIA Authenticator manual setup key</span>
              <code>{manualKey}</code>
              <button type="button" className={styles.manualToggle} onClick={() => setShowManualKey(false)}>Hide setup key</button>
            </div>
          ) : (
            <button type="button" className={styles.manualToggle} onClick={() => setShowManualKey(true)}>Can’t scan the QR? Show setup key</button>
          )
        ) : null}

        <label className={styles.field} htmlFor="workspace-mfa-code">
          <span>KRAVIA Authenticator code</span>
          <input
            id="workspace-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={isPending}
          />
        </label>

        {status ? <p className={styles.status} role="status">{status}</p> : null}

        <button className={styles.primary} type="submit" disabled={isPending}>
          {isPending ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />}
          Verify and continue
        </button>
        <div className={styles.links}><Link href="/office/authenticator">Install / setup KRAVIA Authenticator</Link></div>
        <p className={styles.note}>KRAVIA Authenticator generates the code locally on your phone. The verification code is never stored by the KRAVIA website.</p>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={signIn} noValidate>
      <div className={styles.icon}><KeyRound /></div>
      <p className={styles.eyebrow}>{workspace === "finance" ? "KRAVIA FINANCE · OFFICIAL ACCESS" : "KRAVIA OFFICE · OFFICIAL ACCESS"}</p>
      <h2>Sign in to KRAVIA {workspace === "finance" ? "Finance" : "Office"}</h2>
      <p className={styles.intro}>This private workspace is operated by Kravia Private Limited for authorised personnel only.</p>
      <p className={styles.identityNotice}>Only enter a password you created for KRAVIA {workspace === "finance" ? "Finance" : "Office"} on <b>www.kraviaprivatelimited.com</b>. Kravia does not request this password by email, phone or on a third-party page.</p>

      {configurationRequired ? <p className={styles.alert}>Internal identity service is not active on this deployment.</p> : null}
      {reason === "mfa_required" ? <p className={styles.alert}>Complete multi-factor verification before opening this workspace.</p> : null}
      {reason === "workspace_forbidden" ? <p className={styles.alert}>Your current role does not grant access to this workspace.</p> : null}
      {reason === "invite_invalid" ? <p className={styles.alert}>That private registration link is invalid, expired or already used.</p> : null}

      <label className={styles.field} htmlFor={`${workspace}-email`}>
        <span>Corporate email</span>
        <input
          id={`${workspace}-email`}
          type="email"
          autoComplete="email"
          required
          placeholder="name@kraviaprivatelimited.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending || configurationRequired}
        />
      </label>

      <label className={styles.field} htmlFor={`${workspace}-password`}>
        <span>Password</span>
        <div className={styles.passwordWrap}>
          <input
            id={`${workspace}-password`}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={8}
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending || configurationRequired}
          />
          <button type="button" className={styles.eye} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </label>

      {status ? <p className={styles.status} role="status">{status}</p> : null}

      <button className={styles.primary} type="submit" disabled={isPending || configurationRequired}>
        {isPending ? <LoaderCircle className={styles.spin} /> : <ArrowRight />}
        Sign in to KRAVIA {workspace === "finance" ? "Finance" : "Office"}
      </button>

      <div className={styles.links}>
        <Link href="/office/authenticator">Get KRAVIA Authenticator</Link>
        <Link href="/office/recover">Recover access</Link>
        {registrationOpen ? <Link href="/office/register">Founder registration</Link> : null}
      </div>
      <p className={styles.note}>Private access only. New users join through private, Founder-issued registration links.</p>
    </form>
  );
}
