"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceSignOutButton } from "@/components/workspace-sign-out-button";
import { CircleCheck, LockKeyhole, RefreshCw } from "lucide-react";
import styles from "./office-workspace-processing.module.css";

export function OfficeWorkspaceProcessing({ displayName, initialStatus }: {
  displayName?: string;
  initialStatus: "PENDING" | "REQUESTED";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function requestActivation() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/office-auth/workspace-activation", {
        method: "POST", credentials: "same-origin", cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Unable to submit request");
      setStatus("REQUESTED");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit workspace request");
    } finally {
      setPending(false);
    }
  }
  return <main className={styles.shell}>
    <section className={styles.card} aria-label="KRAVIA Office workspace activation">
      <div className={styles.symbol}><LockKeyhole aria-hidden="true" /></div>
      <span className={styles.eyebrow}>KRAVIA PRIVATE LIMITED · OFFICE ACCESS</span>
      <h1>Workspace is processing</h1>
      <p className={styles.intro}>
        {displayName ? "Hello " + displayName + ". " : ""}
        Your identity is verified. Operational access is locked until the Founder
        approves your assigned roles and permissions.
      </p>
      <p className={styles.status} role="status">
        <CircleCheck aria-hidden="true" />
        {status === "REQUESTED" ? "Activation requested — awaiting Founder approval" : "Role assignment and activation pending"}
      </p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {status === "PENDING" ? <button className={styles.primary} type="button"
        disabled={pending} onClick={() => void requestActivation()}>
        {pending ? "Submitting request…" : "Request workspace activation"}
      </button> : null}
      <button className={styles.secondary} type="button" onClick={() => router.refresh()}>
        <RefreshCw aria-hidden="true" /> Check access status
      </button>
      <div className={styles.footer}><WorkspaceSignOutButton workspace="office" /></div>
    </section>
  </main>;
}
