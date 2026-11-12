import { redirect } from "next/navigation";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { OfficeWorkspaceProcessing } from "@/components/office-workspace-processing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficeProcessingPage() {
  const ctx = await getOfficeSessionContext();
  if (!ctx || !officeIdentityIsProvisioned(ctx.identity))
    redirect("/office/login");
  if (ctx.identity.aal !== "aal2")
    redirect("/office/login?reason=mfa_required");
  if (ctx.identity.workspaceStatus === "ACTIVE")
    redirect("/office/dashboard");
  return <OfficeWorkspaceProcessing displayName={ctx.identity.displayName}
    initialStatus={ctx.identity.workspaceStatus} />;
}
