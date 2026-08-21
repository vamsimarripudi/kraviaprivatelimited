"use client";

import { useState } from "react";
import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { submitContentReview } from "@/app/corporate/content/actions";
import type { ReviewDomain } from "@/lib/content/types";

type ReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
type Review = { domain: ReviewDomain; status: ReviewStatus; canDecide: boolean };

export function ContentReviewControls({ id, reviews }: { id: string; reviews: readonly Review[] }) {
  const [pendingDomain, setPendingDomain] = useState<ReviewDomain>();
  const [message, setMessage] = useState<string>();

  async function decide(domain: ReviewDomain, decision: "APPROVED" | "CHANGES_REQUESTED") {
    setPendingDomain(domain);
    setMessage(undefined);
    try {
      await submitContentReview({ id, domain, decision });
      window.location.reload();
    } catch {
      setMessage("This review decision could not be saved. Confirm your assigned domain and current MFA level.");
    } finally {
      setPendingDomain(undefined);
    }
  }

  return <div className="content-review-controls"><p className="content-review-label">Required reviews</p><ul>{reviews.map((review) => <li key={review.domain}><span className={`review-state is-${review.status.toLowerCase()}`}>{review.status.replaceAll("_", " ")}</span><strong>{review.domain}</strong>{review.status === "PENDING" && review.canDecide ? <div><button type="button" className="button button-light" disabled={Boolean(pendingDomain)} onClick={() => void decide(review.domain, "CHANGES_REQUESTED")}>{pendingDomain === review.domain ? <LoaderCircle className="spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}Changes</button><button type="button" className="button button-dark" disabled={Boolean(pendingDomain)} onClick={() => void decide(review.domain, "APPROVED")}>{pendingDomain === review.domain ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Approve</button></div> : null}</li>)}</ul>{message ? <p className="content-lifecycle-message" role="status">{message}</p> : null}</div>;
}