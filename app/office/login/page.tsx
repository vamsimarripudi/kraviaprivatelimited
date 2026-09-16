import Link from "next/link";
import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getOfficeEnvironment } from "@/lib/env/office";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

export default async function OfficeLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/office") ? next : "/office/dashboard";
  return <main className="office-login workspace-login">
    <div className="workspace-login-intro">
      <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
      <h1>Office<br /><em>Workspace</em></h1>
      <p>Private company operations for authorised directors, employees and assigned professionals. Every protected session requires password authentication and TOTP MFA.</p>
      <div className="workspace-login-facts"><span>Invite only</span><span>AAL2 required</span><span>No public indexing</span></div>
      <Link href="/" className="text-link">Return to public website</Link>
    </div>
    <section className="login-card" aria-label="KRAVIA Office sign in">
      <WorkspaceLoginForm workspace="office" nextPath={nextPath} configurationRequired={!getOfficeEnvironment()} reason={reason} />
    </section>
  </main>;
}
