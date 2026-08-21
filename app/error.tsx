"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-react";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="route-recovery shell" id="main-content">
      <div className="route-recovery-mark route-recovery-mark-warning" aria-hidden="true"><TriangleAlert /></div>
      <p className="eyebrow">SERVICE UNAVAILABLE</p>
      <h1>That did not load<br /><em>as expected.</em></h1>
      <p>Nothing was submitted or changed. Try loading the page again, or return to the Kravia home page.</p>
      <div className="route-recovery-actions">
        <button className="button button-dark" type="button" onClick={reset}><RefreshCw /> Try again</button>
        <Link className="text-link" href="/"><ArrowLeft /> Return home</Link>
      </div>
    </main>
  );
}