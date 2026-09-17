"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, MailCheck } from "lucide-react";

async function requestRecovery(email: string) {
  const response = await fetch("/api/office-auth/recovery/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Recovery request failed");
  }
}

export function WorkspaceRecoveryForm({ configurationRequired }: { configurationRequired: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(undefined);
    try {
      await requestRecovery(email.trim().toLowerCase());
      setSent(true);
      setStatus("If an active KRAVIA Office identity exists for this address, a recovery link has been sent. Use only the newest email.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recovery is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="corporate-auth-form" onSubmit={submit} noValidate>
      <div className="corporate-auth-icon">{sent ? <MailCheck /> : <KeyRound />}</div>
      <p className="eyebrow">SECURE ACCOUNT RECOVERY</p>
      <h2>Recover KRAVIA Office access</h2>
      <p>Enter your Office email address. Recovery links are single-use and short-lived. Existing MFA remains in force.</p>
      <label>
        Office email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending || configurationRequired}
        />
      </label>
      {status ? <p className="corporate-auth-status" role="status">{status}</p> : null}
      {configurationRequired ? <p className="corporate-auth-status" role="alert">Office identity recovery is not configured on this runtime.</p> : null}
      <button className="button button-dark corporate-auth-submit" type="submit" disabled={pending || configurationRequired || !email.trim()}>
        {pending ? <LoaderCircle className="spin" /> : <MailCheck />} Send recovery link
      </button>
      <p className="corporate-auth-note">KRAVIA will never ask you to send a password, recovery token, authenticator code, or secret key by email or chat.</p>
    </form>
  );
}
