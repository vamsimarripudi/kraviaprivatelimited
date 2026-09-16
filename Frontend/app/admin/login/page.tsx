import Link from "next/link";
import { CorporateLoginForm } from "@/components/corporate-login-form";
import { getPublicSupabaseEnvironment } from "@/lib/env/public";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

export default async function AdminLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/admin") ? next : "/admin";
  return <main className="office-login workspace-login admin-login">
    <div className="workspace-login-intro">
      <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
      <h1>Website<br /><em>Administration</em></h1>
      <p>This sign-in controls the public website, governed content and public request operations. It is deliberately separate from KRAVIA Office and Finance identity.</p>
      <div className="workspace-login-facts"><span>Public-site controls</span><span>Separate identity boundary</span><span>No public signup</span></div>
      <Link href="/" className="text-link">Return to public website</Link>
    </div>
    <section className="login-card" aria-label="KRAVIA website administration sign in">
      <CorporateLoginForm nextPath={nextPath} recoveryPath="/admin" configurationRequired={!getPublicSupabaseEnvironment() || reason === "configuration_required"} />
    </section>
  </main>;
}
