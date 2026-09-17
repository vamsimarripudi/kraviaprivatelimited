import Link from "next/link";
import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getOfficeEnvironment } from "@/lib/env/office";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

function recoveryNotice(reason?: string) {
  if (reason === "password_reset") {
    return "Password updated. Sign in again with the new password. Your existing authenticator factor remains required.";
  }
  if (reason === "recovery_invalid") {
    return "That recovery link is invalid, expired, or already used. Request a new link below.";
  }
  return undefined;
}

export default async function OfficeLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/office") ? next : "/office/dashboard";
  const notice = recoveryNotice(reason);

  return (
    <main className="office-login workspace-login">
      <div className="office-login-backdrop" />
      <section className="office-login-brand">
        <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
        <h1>KRAVIA Office</h1>
        <p>Restricted company operating workspace for authorized KRAVIA personnel.</p>
        <div className="office-login-security">Identity verified · role controlled · audit aware</div>
        <Link href="/" className="text-link">Return to corporate website</Link>
      </section>
      <section className="office-login-card">
        {notice ? <p className="corporate-auth-status" role="status">{notice}</p> : null}
        <WorkspaceLoginForm
          workspace="office"
          nextPath={nextPath}
          configurationRequired={!getOfficeEnvironment()}
          reason={reason}
        />
        <p className="corporate-auth-note">
          Can&apos;t access your account? <Link href="/office/recover" className="text-link">Recover Office access</Link>
        </p>
      </section>
    </main>
  );
}
