import Link from "next/link";
import { WorkspaceRecoveryForm } from "@/components/workspace-recovery-form";
import { getOfficeEnvironment } from "@/lib/env/office";

export default function OfficeRecoveryPage() {
  return (
    <main className="office-login workspace-login">
      <div className="office-login-backdrop" />
      <section className="office-login-brand">
        <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
        <h1>Office Recovery</h1>
        <p>Password recovery is isolated from the Railway API and handled only on the canonical KRAVIA frontend.</p>
        <div className="office-login-security">Single-use token · signed recovery state · MFA preserved</div>
        <Link href="/office/login" className="text-link">Back to Office sign in</Link>
      </section>
      <section className="office-login-card">
        <WorkspaceRecoveryForm configurationRequired={!getOfficeEnvironment()} />
      </section>
    </main>
  );
}
