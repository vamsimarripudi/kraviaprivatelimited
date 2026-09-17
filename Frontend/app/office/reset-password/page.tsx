import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceResetPasswordForm } from "@/components/workspace-reset-password-form";
import { getOfficeSessionContext, officeIdentityIsProvisioned, officeRecoveryIsVerified } from "@/lib/office/auth-server";

export default async function OfficeResetPasswordPage() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) {
    redirect("/office/login?reason=recovery_invalid");
  }
  if (!(await officeRecoveryIsVerified(context.identity.userId))) {
    redirect("/office/login?reason=recovery_invalid");
  }

  return (
    <main className="office-login workspace-login">
      <div className="office-login-backdrop" />
      <section className="office-login-brand">
        <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
        <h1>Secure Password Reset</h1>
        <p>This page is available only after a valid, single-use Office recovery token has been exchanged.</p>
        <div className="office-login-security">15-minute recovery authorization · global session revocation</div>
        <Link href="/office/login" className="text-link">Cancel and return to sign in</Link>
      </section>
      <section className="office-login-card">
        <WorkspaceResetPasswordForm email={context.identity.email} />
      </section>
    </main>
  );
}
