"use client";

import Link from "next/link";
import { type CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { officeTotpWindow } from "@/lib/office/totp-window";
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
  email_otp_available?: boolean;
  display_role?: string;
  mfa: { enrolled: boolean; verified?: boolean; factor_ids: string[] };
};
type Props = {
  workspace: WorkspaceKind;
  nextPath: string;
  configurationRequired?: boolean;
  reason?: string;
  registrationOpen?: boolean;
};
type DeviceApprovalResponse = {
  status: "PENDING" | "APPROVED" | "DECLINED" | "EXPIRED" | "DELIVERY_FAILED" | "DELIVERY_UNKNOWN" | "REVOKED" | "TRUSTED";
  expires_at: string;
  device_label: string;
};
type QrSigninResponse = {
  request_id?: string;
  status: "PENDING" | "SCANNED" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED" | "CONSUMED";
  expires_at?: string;
  browser_label?: string;
  qr_payload?: string;
  verified?: boolean;
  aal?: "aal2";
};
type Phase = "password" | "email" | "activate" | "verify" | "qr" | "device-approval" | "success";
type StatusTone = "info" | "error" | "success";

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

function QrImage({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 384,
      color: { dark: "#10241c", light: "#ffffff" },
    }).then((next) => {
      if (active) setDataUrl(next);
    }).catch(() => {
      if (active) setDataUrl(undefined);
    });
    return () => { active = false; };
  }, [value]);
  if (!dataUrl) return <div className={styles.qrLoading} aria-label="Preparing secure sign-in QR code"><LoaderCircle className={styles.spin} /></div>;
  return <img className={styles.qrImage} src={dataUrl} alt="Scan this one-time QR code only with KRAVIA Authenticator" />;
}


function SecurityJourney({ phase, error = false }: { phase: Phase; error?: boolean }) {
  const active = phase === "password" ? 0 : ["email", "activate", "verify", "qr"].includes(phase) ? 1 : phase === "device-approval" ? 2 : 3;
  const steps = ["Credentials", "MFA", "Device trust", "Office"] as const;
  return (
    <div className={styles.journey} role="group" aria-label={`Secure sign-in: ${steps[active]}, step ${active + 1} of 4`}>
      {steps.map((label, index) => {
        const state = index < active ? "complete" : index > active ? "upcoming" : error ? "error" : "current";
        return (
          <span
            key={label}
            className={styles.journeyStep}
            data-state={state}
            aria-current={index === active ? "step" : undefined}
            aria-label={index === active ? `${label}, ${error ? "needs attention" : "current"}` : `${label}, ${state === "complete" ? "completed" : "pending"}`}
          >
            {index === active ? (
              <>
                {error ? <i className={styles.journeyDot} aria-hidden="true" /> : null}
                <b>{label}</b>
              </>
            ) : <i className={styles.journeyDot} aria-hidden="true" />}
          </span>
        );
      })}
    </div>
  );
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
  const [code, setCode] = useState("");
  const [emailOtp, setEmailOtp] = useState<{ challenge_id: string; challenge_token: string; email: string; expires_at: string; resend_available_at: string }>();
  const [emailOtpAllowed, setEmailOtpAllowed] = useState(false);
  const [authenticatorEnrolled, setAuthenticatorEnrolled] = useState(false);
  const [status, setStatus] = useState<string>();
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [isPending, setIsPending] = useState(false);
  const [destination, setDestination] = useState(nextPath);
  const [now, setNow] = useState(() => Date.now());
  const [activeTotpWindow, setActiveTotpWindow] = useState<number | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [deviceApprovalExpiresAt, setDeviceApprovalExpiresAt] = useState<string>();
  const [deviceApprovalLabel, setDeviceApprovalLabel] = useState<string>();
  const [deviceApprovalRetryRequired, setDeviceApprovalRetryRequired] = useState(false);
  const deviceApprovalCompletionInFlight = useRef(false);
  const [qrPayload, setQrPayload] = useState<string>();
  const [qrExpanded, setQrExpanded] = useState(false);
  const qrDialogRef = useRef<HTMLDialogElement>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string>();
  const [qrBrowserLabel, setQrBrowserLabel] = useState<string>();
  const totp = officeTotpWindow(now);

  useEffect(() => {
    const dialog = qrDialogRef.current;
    if (!dialog) return;
    if (qrExpanded && !dialog.open) dialog.showModal();
    if (!qrExpanded && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [qrExpanded]);

  useEffect(() => {
    if (phase !== "qr") setQrExpanded(false);
  }, [phase]);

  async function finish(path = destination) {
    router.replace(path);
    router.refresh();
  }

  useEffect(() => {
    if (phase !== "verify" && phase !== "qr" && phase !== "device-approval") return;
    setNow(Date.now());
    if (phase === "verify") {
      setActiveTotpWindow(officeTotpWindow().index);
      setCodeExpired(false);
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "verify" || activeTotpWindow === null || totp.index === activeTotpWindow) return;
    setActiveTotpWindow(totp.index);
    setCode("");
    setCodeExpired(true);
    setStatus("That Authenticator code has expired. Enter the new code shown on your approved phone.");
    setStatusTone("error");
  }, [activeTotpWindow, phase, totp.index]);

  useEffect(() => {
    if (phase !== "success") return;
    const timeout = window.setTimeout(() => {
      router.replace(destination);
      router.refresh();
    }, 1_200);
    return () => window.clearTimeout(timeout);
  }, [destination, phase, router]);

  useEffect(() => {
    if (phase !== "device-approval") return;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (checking || disposed) return;
      checking = true;
      try {
        const approval = await jsonRequest<DeviceApprovalResponse>("/api/office-auth/device-approval/status", {});
        if (disposed) return;
        setDeviceApprovalExpiresAt(approval.expires_at);
        setDeviceApprovalLabel(approval.device_label);
        if (approval.status === "APPROVED" || approval.status === "TRUSTED") {
          // An approved mailbox decision is durable, but redeeming it makes a
          // browser session. Do not hammer that protected endpoint or cycle
          // the person between optimistic and error messages if the runtime
          // is temporarily unavailable. TRUSTED is also recoverable here: an
          // earlier completion may have committed before its response reached
          // this browser. An explicit retry is safe because completion is
          // idempotent for this browser proof.
          if (deviceApprovalRetryRequired || deviceApprovalCompletionInFlight.current) return;
          deviceApprovalCompletionInFlight.current = true;
          setStatus("Your device was approved. Securing this browser…");
          setStatusTone("success");
          try {
            const completed = await jsonRequest<{ verified: true; aal: "aal2" }>("/api/office-auth/device-approval/complete", {});
            if (!disposed && completed.verified) {
              setStatus("Device approved. Opening your authorised KRAVIA workspace…");
              setPhase("success");
            }
          } catch {
            if (!disposed) {
              setDeviceApprovalRetryRequired(true);
              setStatus("Your device is approved, but this browser could not finish the secure sign-in. Retry when you are ready.");
              setStatusTone("error");
            }
          } finally {
            deviceApprovalCompletionInFlight.current = false;
          }
        } else if (["DECLINED", "EXPIRED", "DELIVERY_FAILED", "DELIVERY_UNKNOWN", "REVOKED"].includes(approval.status)) {
          setStatus(
            approval.status === "DECLINED"
              ? "This new device was declined and cannot enter KRAVIA Office."
              : "This device approval request is no longer available. Sign in again to start a new request.",
          );
          setStatusTone("error");
          setPhase("password");
        }
      } catch (error) {
        if (!disposed) {
          setStatus(error instanceof Error ? error.message : "Unable to check device approval.");
          setStatusTone("error");
        }
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 4_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [deviceApprovalRetryRequired, phase]);

  useEffect(() => {
    if (phase !== "qr") return;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (checking || disposed) return;
      checking = true;
      try {
        const approval = await jsonRequest<QrSigninResponse>("/api/office-auth/qr-signin/status", {});
        if (disposed) return;
        if (approval.expires_at) setQrExpiresAt(approval.expires_at);
        if (approval.browser_label) setQrBrowserLabel(approval.browser_label);
        if (approval.verified === true && approval.aal === "aal2") {
          setStatus("Authenticator approval confirmed. Opening your authorised workspace…");
          setStatusTone("success");
          setPhase("success");
          return;
        }
        if (approval.status === "SCANNED") {
          setStatus("Authenticator has scanned this request. Confirm the browser details on your trusted phone.");
          setStatusTone("info");
        }
        if (["REJECTED", "EXPIRED", "REVOKED"].includes(approval.status)) {
          setQrPayload(undefined);
          setStatusTone("error");
          if (approval.status === "REJECTED") {
            setStatus("This browser sign-in was rejected on the trusted phone. Sign in again.");
            setPhase("password");
          } else {
            // QR expiry/replacement leaves the password-only browser session intact.
            setStatus("The QR request expired or was replaced. Use Authenticator approval to generate a new code.");
            setPhase("verify");
          }
          return;
        }
      } catch (error) {
        if (!disposed) {
          setStatus(error instanceof Error ? error.message : "Unable to check Authenticator approval.");
          setStatusTone("error");
        }
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 1_500);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [phase]);

  async function sendInvitedEmailCode() {
    const result = await jsonRequest<{ challenge_id: string; challenge_token: string; email: string; expires_at: string; resend_available_at: string }>(
      "/api/office-auth/invited-email-otp", { action: "request" },
    );
    setEmailOtp(result);
    setStatus("We sent a six-digit verification code to " + result.email + ".");
    setStatusTone("info");
  }

  async function requestAgain() {
    setIsPending(true);
    setStatus(undefined);
    try { await sendInvitedEmailCode(); }
    catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send another email code.");
      setStatusTone("error");
    } finally { setIsPending(false); }
  }

  async function chooseEmailOtp() {
    if (!emailOtpAllowed) return;
    setCode("");
    setEmailOtp(undefined);
    setPhase("email");
    setIsPending(true);
    setStatus(undefined);
    try {
      await sendInvitedEmailCode();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Email code unavailable. Select Send a new email code to retry.");
      setStatusTone("error");
    } finally { setIsPending(false); }
  }

  async function verifyInvitedEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailOtp || !/^\d{6}$/.test(code)) return;
    setIsPending(true);
    setStatus(undefined);
    try {
      await jsonRequest<{ verified: true; aal: "aal2" }>("/api/office-auth/invited-email-otp", {
        action: "verify", challenge_id: emailOtp.challenge_id,
        challenge_token: emailOtp.challenge_token, code,
      });
      setCode("");
      setStatus("Corporate email verified. Opening KRAVIA Office.");
      setStatusTone("success");
      setPhase("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Email verification failed");
      setStatusTone("error");
    } finally { setIsPending(false); }
  }

  async function prepareMfa(auth: SignInResponse) {
    const validRoles = auth.roles.filter((role): role is OfficeRole =>
      ["OWNER", "DIRECTOR", "ADMIN", "MEMBER", "FINANCE", "CA", "CS", "LEGAL", "HR", "OPERATIONS", "AUDITOR", "PRODUCT_ADMIN"].includes(role)
    );
    const defaultPath = preferredLandingPath(validRoles);
    const selected = nextPath === "/office/dashboard" || nextPath === "/finance/dashboard" ? defaultPath : nextPath;
    setDestination(selected);
    setEmailOtpAllowed(auth.email_otp_available === true);
    setAuthenticatorEnrolled(auth.mfa.enrolled);
    setEmailOtp(undefined);
    setCode("");

    if (auth.aal === "aal2") {
      await finish(selected);
      return;
    }

    if (auth.mfa.enrolled) {
      setPhase("verify");
      setStatus("Open Authenticator and enter the current 6-digit code.");
      setStatusTone("info");
      return;
    }
    if (auth.email_otp_available === true) {
      setPhase("email");
      setEmailOtp(undefined);
      try { await sendInvitedEmailCode(); }
      catch (error) {
        setStatus(error instanceof Error ? error.message : "Email code unavailable. Use Send email code to retry.");
        setStatusTone("error");
      }
      return;
    }
    setPhase("activate");
    setStatus("Open Authenticator on your phone and sign in with your corporate credentials to request activation.");
    setStatusTone("info");
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
      setStatusTone("error");
    } finally {
      setIsPending(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setStatus("Enter the current 6-digit code from Authenticator.");
      setStatusTone("error");
      return;
    }
    if (codeExpired) {
      setStatus("That Authenticator code has expired. Enter the new code shown on your approved phone.");
      setStatusTone("error");
      return;
    }
    setIsPending(true);
    setStatus(undefined);
    try {
      const verified = await jsonRequest<{ verified: boolean; aal?: "aal2"; device_approval_pending?: boolean; expires_at?: string; device_label?: string }>("/api/office-auth/mfa", {
        action: "verify",
        code: code.trim(),
      });
      setCode("");
      if (verified.device_approval_pending) {
        deviceApprovalCompletionInFlight.current = false;
        setDeviceApprovalRetryRequired(false);
        setDeviceApprovalExpiresAt(verified.expires_at);
        setDeviceApprovalLabel(verified.device_label);
        setStatus("We sent a device approval request to your registered corporate email. This browser cannot enter Office until you approve it there.");
        setStatusTone("info");
        setPhase("device-approval");
        return;
      }
      if (verified.verified !== true) throw new Error("KRAVIA Office did not complete MFA");
      setStatus("Authenticator code accepted. Opening your authorised workspace…");
      setStatusTone("success");
      setPhase("success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The authenticator code was not accepted.");
      setStatusTone("error");
    } finally {
      setIsPending(false);
    }
  }

  async function showAuthenticatorQr() {
    setIsPending(true);
    setStatus(undefined);
    try {
      const started = await jsonRequest<QrSigninResponse>("/api/office-auth/qr-signin", {});
      if (!started.qr_payload || !started.expires_at || started.status !== "PENDING") {
        throw new Error("KRAVIA Office did not create a secure Authenticator request.");
      }
      setQrPayload(started.qr_payload);
      setQrExpiresAt(started.expires_at);
      setQrBrowserLabel(started.browser_label);
      setStatus("Open Authenticator, scan this one-time code, then confirm the browser details with your biometrics.");
      setStatusTone("info");
      setPhase("qr");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start Authenticator approval.");
      setStatusTone("error");
    } finally {
      setIsPending(false);
    }
  }

  async function cancelAuthenticatorQr() {
    setIsPending(true);
    try {
      await jsonRequest<{ cancelled: boolean }>("/api/office-auth/qr-signin/cancel", {});
    } finally {
      setQrPayload(undefined);
      setStatus("Authenticator approval cancelled. You can use your current code instead.");
      setStatusTone("info");
      setPhase("verify");
      setIsPending(false);
    }
  }

  if (phase === "email") {
    return (
      <form className={styles.form} onSubmit={verifyInvitedEmailCode} noValidate>
        <div className={styles.icon}><ShieldCheck /></div>
        <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
        <p className={styles.eyebrow}>KRAVIA CORPORATE EMAIL OTP</p>
        <h2>Check your corporate email</h2>
        <p className={styles.intro}>
          Enter the six-digit code sent to <strong>{emailOtp?.email || email}</strong>.
          Codes expire after 10 minutes. This option is enabled only for accounts explicitly approved for corporate email verification.
        </p>
        <label className={styles.field} htmlFor="invited-email-code">
          <span>Email verification code</span>
          <input id="invited-email-code" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]*" maxLength={6} required autoFocus
            value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit email code" disabled={isPending}/>
        </label>
        {status ? <p className={styles.status} data-tone={statusTone} role="status">{status}</p> : null}
        <button className={styles.primary} type="submit" disabled={!emailOtp || code.length !== 6 || isPending}>
          {isPending ? <LoaderCircle className={styles.spin}/> : <ShieldCheck/>}
          Verify email and enter Office
        </button>
        <button className={styles.secondary} type="button" disabled={isPending}
          onClick={() => void requestAgain()}>Send a new email code</button>
        {authenticatorEnrolled ? (
          <button className={styles.secondary} type="button" disabled={isPending}
            onClick={() => { setCode(""); setEmailOtp(undefined); setPhase("verify"); setStatus("Enter the six-digit code from KRAVIA Authenticator."); setStatusTone("info"); }}>
            Use KRAVIA Authenticator instead
          </button>
        ) : null}
        <p className={styles.note}>Check Spam if the code is missing. Request again after 60 seconds. Your existing password remains required for each new login.</p>
      </form>
    );
  }

  if (phase === "activate") {
    return (
      <section className={styles.form} aria-labelledby="phone-activation-title">
        <div className={styles.icon}><ShieldCheck /></div>
        <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
        <p className={styles.eyebrow}>MANDATORY MFA</p>
        <h2 id="phone-activation-title">Activate your phone</h2>
        <p className={styles.intro}>
          Authenticator is required for every Office role. Sign in in the app with your corporate credentials, then use the security review sent to your registered email to trust this exact phone.
        </p>
        <p className={styles.identityNotice}>Phone activation happens only in Authenticator. KRAVIA Office never shows a QR code or setup key for device enrollment.</p>
        {status ? <p className={styles.status} data-tone={statusTone} role="status">{status}</p> : null}
        <Link className={styles.primary} href="/office/authenticator">
          Open Authenticator instructions
        </Link>
        <button
          className={styles.secondary}
          type="button"
          onClick={() => {
            setPhase("password");
            setStatus(undefined);
          }}
        >
          Return to sign in
        </button>
        <p className={styles.note}>After you trust the phone from your registered email, enter the current local six-digit code from Authenticator.</p>
      </section>
    );
  }

  if (phase === "verify") {
    return (
      <form className={styles.form} onSubmit={verifyMfa} noValidate>
        <div className={styles.icon}><ShieldCheck /></div>
        <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
        <p className={styles.eyebrow}>MANDATORY MFA</p>
        <h2>Verify your identity</h2>
        <p className={styles.intro}>Your password is correct. Complete the second factor to continue.</p>

        <div className={styles.timer} role="timer" aria-live="polite" aria-label={`Authenticator code changes in ${totp.remaining} seconds`}>
          <div className={styles.timerRing} style={{ "--timer-progress": `${Math.round(totp.progress * 360)}deg` } as CSSProperties}>
            <span>00:{totp.remaining.toString().padStart(2, "0")}</span>
          </div>
          <p>Current code changes in {totp.remaining} seconds</p>
        </div>

        <label className={styles.field} htmlFor="workspace-mfa-code">
          <span>Authenticator code</span>
          <input
            id="workspace-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              if (codeExpired) {
                setCodeExpired(false);
                setStatus("Enter the current code shown in Authenticator.");
                setStatusTone("info");
              }
            }}
            disabled={isPending}
          />
        </label>

        {status ? <p className={styles.status} data-tone={statusTone} role="status">{status}</p> : null}

        <button className={styles.primary} type="submit" disabled={isPending || codeExpired || code.length !== 6}>
          {isPending ? <LoaderCircle className={styles.spin} /> : <ShieldCheck />}
          Verify and continue
        </button>
        {emailOtpAllowed ? (
          <button className={styles.secondary} type="button" onClick={() => void chooseEmailOtp()} disabled={isPending}>
            Send a code to my corporate email instead
          </button>
        ) : null}
        <button className={styles.secondary} type="button" onClick={() => void showAuthenticatorQr()} disabled={isPending}>
          <QrCode /> Use Authenticator approval instead
        </button>
        <div className={styles.links}><Link href="/office/authenticator">Authenticator instructions</Link></div>
        <p className={styles.note}>Authenticator generates the code locally on your approved phone. The verification code is never stored by the KRAVIA website.</p>
      </form>
    );
  }

  if (phase === "success") {
    return (
      <section className={`${styles.form} ${styles.success}`} aria-labelledby="mfa-success-title" aria-live="polite">
        <div className={styles.successIcon}><CheckCircle2 /></div>
        <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
        <p className={styles.eyebrow}>IDENTITY VERIFIED</p>
        <h2 id="mfa-success-title">You’re securely signed in</h2>
        <p className={styles.intro}>Your chosen second factor was verified. We’re opening your authorised KRAVIA workspace now.</p>
        {status ? <p className={styles.status} data-tone="success" role="status">{status}</p> : null}
        <div className={styles.successProgress} aria-hidden="true"><span /></div>
      </section>
    );
  }

  if (phase === "qr" && qrPayload) {
    const expires = qrExpiresAt ? Date.parse(qrExpiresAt) : NaN;
    const secondsRemaining = Number.isFinite(expires) ? Math.max(0, Math.ceil((expires - now) / 1_000)) : null;
    return (
      <section className={`${styles.form} ${styles.qrForm}`} aria-labelledby="qr-approval-title" aria-live="polite">
        <div className={styles.icon}><Smartphone /></div>
        <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
        <p className={styles.eyebrow}>AUTHENTICATOR APPROVAL</p>
        <h2 id="qr-approval-title">Confirm on your trusted phone</h2>
        <p className={styles.intro}>Scan only with KRAVIA Authenticator on your trusted phone. Review this browser, then choose Accept or Reject.</p>
        <div className={styles.qrPanel}>
          <button className={styles.qrZoomTrigger} type="button" onClick={() => setQrExpanded(true)} aria-label="Enlarge sign-in QR code" title="Enlarge QR code">
            <QrImage value={qrPayload} />
          </button>
          <span className={styles.qrHint}>Tap QR to enlarge</span>
        </div>
        <dialog ref={qrDialogRef} className={styles.qrDialog} aria-label="Enlarged KRAVIA Authenticator QR code" onClose={() => setQrExpanded(false)}>
          <button className={styles.qrDialogClose} type="button" onClick={() => setQrExpanded(false)}>Close</button>
          {qrExpanded ? <QrImage value={qrPayload} /> : null}
          <p>Scan only with KRAVIA Authenticator.</p>
        </dialog>
        <div className={styles.timer} role="timer" aria-live="polite" aria-label={secondsRemaining === null ? "QR sign-in request active" : `QR sign-in request expires in ${secondsRemaining} seconds`}>
          <div className={styles.timerRing} style={{ "--timer-progress": `${Math.max(0, Math.min(360, (secondsRemaining ?? 0) * 3))}deg` } as CSSProperties}>
            <span>{secondsRemaining === null ? "WAIT" : `${Math.floor(secondsRemaining / 60).toString().padStart(2, "0")}:${(secondsRemaining % 60).toString().padStart(2, "0")}`}</span>
          </div>
          <p>{qrBrowserLabel ? `${qrBrowserLabel} is waiting for your decision.` : "Waiting for your trusted phone."}</p>
        </div>
        {status ? <p className={styles.status} data-tone={statusTone} role="status">{status}</p> : null}
        <button className={styles.secondary} type="button" onClick={() => void cancelAuthenticatorQr()} disabled={isPending}>Cancel Authenticator approval</button>
        <p className={styles.note}>This QR code expires quickly and cannot sign in a different browser. Never scan it with another app.</p>
      </section>
    );
  }

  if (phase === "device-approval") {
    const expiry = deviceApprovalExpiresAt ? Date.parse(deviceApprovalExpiresAt) : NaN;
    const minutesRemaining = Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - now) / 60_000)) : null;
    return (
      <section className={styles.form} aria-labelledby="device-approval-title" aria-live="polite">
        <div className={styles.icon}><ShieldCheck /></div>
        <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
        <p className={styles.eyebrow}>NEW DEVICE PROTECTION</p>
        <h2 id="device-approval-title">Approve this browser from your email</h2>
        <p className={styles.intro}>
          Your password and Authenticator code were accepted. This new browser stays blocked until the account holder approves the exact request from the registered corporate email.
        </p>
        <div className={styles.timer} role="status" aria-live="polite">
          <div className={styles.timerRing} style={{ "--timer-progress": "270deg" } as CSSProperties}>
            <span>WAIT</span>
          </div>
          <p>{deviceApprovalLabel ? `${deviceApprovalLabel} is waiting for approval.` : "Waiting for the registered-email Trust decision."}</p>
          {minutesRemaining !== null ? <p>Request expires in about {minutesRemaining} minute{minutesRemaining === 1 ? "" : "s"}.</p> : null}
        </div>
        {status ? <p className={styles.status} data-tone={statusTone} role="status">{status}</p> : null}
        {deviceApprovalRetryRequired ? (
          <button
            className={styles.primary}
            type="button"
            onClick={() => {
              setDeviceApprovalRetryRequired(false);
              setStatus("Retrying the secure browser sign-in…");
              setStatusTone("info");
            }}
          >
            Retry secure sign-in
          </button>
        ) : null}
        <button className={styles.secondary} type="button" onClick={() => { setPhase("password"); setStatus(undefined); }}>
          Return to sign in
        </button>
        <p className={styles.note}>The approval email cannot sign in the browser that opens it. Only this original browser can finish the request.</p>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={signIn} noValidate data-office-login-release="2026-11-12-email-otp-choice">
      <div className={styles.icon}><KeyRound /></div>
      <SecurityJourney phase={phase} error={Boolean(status) && statusTone === "error"} />
      <p className={styles.eyebrow}>{workspace === "finance" ? "KRAVIA FINANCE · OFFICIAL ACCESS" : "KRAVIA OFFICE · OFFICIAL ACCESS"}</p>
      <h2>Sign in to KRAVIA {workspace === "finance" ? "Finance" : "Office"}</h2>
      <p className={styles.intro}>Enter your password first, then use KRAVIA Authenticator or corporate email OTP if enabled for your account.</p>

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

      {status ? <p className={styles.status} data-tone={statusTone} role="status">{status}</p> : null}

      <button className={styles.primary} type="submit" disabled={isPending || configurationRequired}>
        {isPending ? <LoaderCircle className={styles.spin} /> : <ArrowRight />}
        Sign in to KRAVIA {workspace === "finance" ? "Finance" : "Office"}
      </button>

      <div className={styles.links}>
        <Link href="/office/authenticator">Get Authenticator</Link>
        <Link href="/office/recover">Recover access</Link>
        {registrationOpen ? <Link href="/office/register">Founder registration</Link> : null}
      </div>
      <p className={styles.note}>Only sign in at <b>www.kraviaprivatelimited.com</b>. KRAVIA never requests your password by email or phone.</p>
    </form>
  );
}
