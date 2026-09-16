import "server-only";
import { redirect } from "next/navigation";
import { getOfficeEnvironment } from "@/lib/env/office";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";
import { preferredWorkspace, roleCanAccessWorkspace, workspaceDefinitions, type WorkspaceKind } from "@/lib/office/workspaces";

function loginUrl(workspace: WorkspaceKind, nextPath: string, reason?: string) {
  const params = new URLSearchParams({ next: nextPath });
  if (reason) params.set("reason", reason);
  return `${workspaceDefinitions[workspace].loginPath}?${params.toString()}`;
}

export async function requireWorkspaceIdentity(workspace: WorkspaceKind, nextPath: string) {
  if (!getOfficeEnvironment()) redirect(loginUrl(workspace, nextPath, "configuration_required"));
  const context = await getOfficeSessionContext();
  if (!context) redirect(loginUrl(workspace, nextPath));
  if (!officeIdentityIsProvisioned(context.identity)) redirect(loginUrl(workspace, nextPath, "access_not_active"));
  if (context.identity.aal !== "aal2") redirect(loginUrl(workspace, nextPath, "mfa_required"));
  if (!roleCanAccessWorkspace(workspace, context.identity.roles)) {
    const preferred = preferredWorkspace(context.identity.roles);
    if (preferred && preferred !== workspace) redirect(`/${preferred}`);
    redirect(loginUrl(workspace, nextPath, "workspace_forbidden"));
  }
  return context.identity;
}
