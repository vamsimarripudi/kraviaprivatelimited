"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";

type Props = { decision: "approve" | "decline" };

export function OfficeDeviceApprovalForm({ decision }: Props) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"APPROVED" | "DECLINED" | null>(null);
  const [error, setError] = useState<string>();
  const approve = decision === "approve";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/office-auth/device-approval/action", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || (body.status !== "APPROVED" && body.status !== "DECLINED")) {
        throw new Error(typeof body.detail === "string" ? body.detail : "Unable to decide this device request");
      }
      setResult(body.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to decide this device request");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const approved = result === "APPROVED";
    return (
      <section aria-live="polite" style={{ display: "grid", gap: 18, fontFamily: 'Inter,"Segoe UI",sans-serif' }}>
        <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 14, background: approved ? "#e9f6ef" : "#fff0ec", color: approved ? "#156c42" : "#9d3322" }}>
          {approved ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
        </div>
        <h1 style={{ margin: 0, color: "#13213c", fontFamily: "Georgia,serif", fontSize: 32 }}>{approved ? "Device approved" : "Device declined"}</h1>
        <p style={{ margin: 0, color: "#45556e", fontSize: 16, lineHeight: 1.65 }}>
          {approved ? "Return to the original browser that requested access. Only that browser can finish signing in." : "The pending browser has been blocked and cannot enter KRAVIA Office."}
        </p>
        <Link href="/office/login" style={{ color: "#193B5B", fontWeight: 700, textDecoration: "none" }}>KRAVIA Office sign in</Link>
      </section>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 18, fontFamily: 'Inter,"Segoe UI",sans-serif' }}>
      <div style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: 14, background: approve ? "#e9f6ef" : "#fff0ec", color: approve ? "#156c42" : "#9d3322" }}>
        {approve ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
      </div>
      <p style={{ margin: 0, color: "#193B5B", fontSize: 11, fontWeight: 800, letterSpacing: 1.8 }}>{approve ? "DEVICE APPROVAL" : "DEVICE DECLINE"}</p>
      <h1 style={{ margin: 0, color: "#13213c", fontFamily: "Georgia,serif", fontSize: 32 }}>{approve ? "Approve this new device?" : "Decline this new device?"}</h1>
      <p style={{ margin: 0, color: "#45556e", fontSize: 16, lineHeight: 1.65 }}>
        {approve ? "Confirm only if you started the sign-in. This will authorise the original browser that requested access, not this browser." : "Confirm if you did not start the sign-in. The original browser will be blocked immediately."}
      </p>
      {error ? <p role="alert" style={{ margin: 0, color: "#9d3322", lineHeight: 1.5 }}>{error}</p> : null}
      <button type="submit" disabled={pending} style={{ minHeight: 48, border: 0, background: approve ? "#193B5B" : "#9d3322", color: "#fff", fontWeight: 800, cursor: pending ? "wait" : "pointer" }}>
        {pending ? <LoaderCircle size={18} style={{ verticalAlign: "middle", marginRight: 8 }} /> : null}
        {approve ? "Approve original browser" : "Decline device"}
      </button>
      <Link href="/office/login" style={{ color: "#193B5B", fontWeight: 700, textAlign: "center", textDecoration: "none" }}>Cancel</Link>
    </form>
  );
}
