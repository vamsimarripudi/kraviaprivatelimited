import Link from "next/link";
import { ArrowLeft, ArrowUpRight, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="route-recovery shell" id="main-content">
      <div className="route-recovery-mark" aria-hidden="true"><SearchX /></div>
      <p className="eyebrow">404 / NOT FOUND</p>
      <h1>This page is not<br /><em>part of Kravia.</em></h1>
      <p>The address may be out of date, or the page may no longer be public. You can return to the company home or explore the current portfolio.</p>
      <div className="route-recovery-actions">
        <Link className="button button-dark" href="/"><ArrowLeft /> Return home</Link>
        <Link className="text-link" href="/products">Explore products <ArrowUpRight /></Link>
      </div>
    </main>
  );
}