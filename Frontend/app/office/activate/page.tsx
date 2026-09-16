import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceActivationForm } from "@/components/workspace-activation-form";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { preferredLandingPath } from "@/lib/office/workspaces";

export const dynamic="force-dynamic"; export const revalidate=0;
export default async function OfficeActivate(){const context=await getOfficeSessionContext();if(!context||!officeIdentityIsProvisioned(context.identity))redirect("/office/login?reason=invite_required");const nextPath=preferredLandingPath(context.identity.roles);if(context.identity.aal==="aal2")redirect(nextPath);return <main className="office-login workspace-login"><div className="workspace-login-intro"><p className="eyebrow">KRAVIA PRIVATE LIMITED</p><h1>Account<br/><em>Activation</em></h1><p>Your invitation establishes identity and role intent. Activation requires a strong password and authenticator MFA before any Office or Finance workspace opens.</p><div className="workspace-login-facts"><span>Invite only</span><span>Strong password</span><span>TOTP AAL2</span></div><Link href="/" className="text-link">Return to public website</Link></div><section className="login-card" aria-label="Activate KRAVIA Office account"><WorkspaceActivationForm email={context.identity.email} nextPath={nextPath}/></section></main>}
