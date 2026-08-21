"use client";

import { FormEvent, useState } from "react";
import { Archive, CheckCircle2, LoaderCircle, Send, Upload } from "lucide-react";
import { approveContent, archiveContent, publishContent, requestContentReview } from "@/app/corporate/content/actions";

type LifecycleStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

type ContentLifecycleActionsProps = {
  id: string;
  status: LifecycleStatus;
  canRequestReview: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canArchive: boolean;
};

export function ContentLifecycleActions({ id, status, canRequestReview, canApprove, canPublish, canArchive }: ContentLifecycleActionsProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    setPending(true);
    setMessage(undefined);
    try {
      await action();
      setMessage(success);
      window.location.reload();
    } catch {
      setMessage("This action could not be completed. Confirm the workflow state, your role, and MFA step-up if required.");
    } finally {
      setPending(false);
    }
  }

  function archive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 3) {
      setMessage("Enter a short archive reason so the audit record remains useful.");
      return;
    }
    void run(() => archiveContent({ id, reason }), "The content record was archived and removed from public visibility.");
  }

  const canRequest = canRequestReview && (status === "DRAFT" || status === "CHANGES_REQUESTED");
  const canMoveToApproved = canApprove && status === "IN_REVIEW";
  const canMakePublic = canPublish && status === "APPROVED";
  const canRemoveFromPublic = canArchive && (status === "DRAFT" || status === "IN_REVIEW" || status === "CHANGES_REQUESTED" || status === "APPROVED" || status === "SCHEDULED" || status === "PUBLISHED");

  return <div className="content-lifecycle-actions">
    <div className="content-lifecycle-buttons">
      {canRequest ? <button type="button" className="button button-light" disabled={pending} onClick={() => void run(() => requestContentReview({ id }), "Review requirements were assigned to the appropriate queue.")}><Send aria-hidden="true" /> Request review</button> : null}
      {canMoveToApproved ? <button type="button" className="button button-light" disabled={pending} onClick={() => void run(() => approveContent({ id }), "The record was approved. It can now be published by an authorised publisher.")}><CheckCircle2 aria-hidden="true" /> Approve</button> : null}
      {canMakePublic ? <button type="button" className="button button-dark" disabled={pending} onClick={() => void run(() => publishContent({ id }), "The approved record is now public.")}><Upload aria-hidden="true" /> Publish</button> : null}
      {canRemoveFromPublic && !confirmArchive ? <button type="button" className="button button-quiet" disabled={pending} onClick={() => setConfirmArchive(true)}><Archive aria-hidden="true" /> Archive</button> : null}
    </div>
    {confirmArchive ? <form onSubmit={archive} className="content-archive-confirm"><label>Archive reason<input name="reason" required minLength={3} maxLength={1000} placeholder="For example: superseded by an approved update" /></label><div><button type="button" className="button button-light" disabled={pending} onClick={() => setConfirmArchive(false)}>Cancel</button><button className="button button-dark" disabled={pending}>{pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <Archive aria-hidden="true" />}{pending ? "Archiving…" : "Confirm archive"}</button></div></form> : null}
    {message ? <p className="content-lifecycle-message" role="status">{message}</p> : null}
  </div>;
}