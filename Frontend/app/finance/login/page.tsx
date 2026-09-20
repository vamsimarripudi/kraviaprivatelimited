import Link from "next/link";
import type { Metadata } from "next";
import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getOfficeEnvironment } from "@/lib/env/office";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

export const metadata: Metadata = {
  title: "KRAVIA Finance | Authorised company access",
  description: "Private finance workspace for authorised Kravia personnel and professional advisers.",
  alternates: { canonical: "/finance/login" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function FinanceLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/finance") ? next : "/finance/dashboard";
  return <main className="office-login workspace-login workspace-finance-login">
    <div className="workspace-login-intro">
      <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
      <h1>Finance<br /><em>&amp; Tax</em></h1>
      <p>Restricted workspace for authorised finance staff, CA, auditors and directors. GST, accounting, treasury and reconciliation remain separated from unrelated Office functions.</p>
      <div className="workspace-login-facts"><span>Role scoped</span><span>AAL2 required</span><span>Evidence first</span></div>
      <Link href="/" className="text-link">Return to public website</Link>
    </div>
    <section className="login-card" aria-label="KRAVIA Finance sign in">
      <WorkspaceLoginForm workspace="finance" nextPath={nextPath} configurationRequired={!getOfficeEnvironment()} reason={reason} />
    </section>
  </main>;
}
