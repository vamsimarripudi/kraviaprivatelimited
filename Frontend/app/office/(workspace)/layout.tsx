import { OfficeWorkspaceShell } from "@/components/office-workspace-shell";
import { getOfficeCapabilitySnapshot } from "@/lib/office/capability-server";
import { requireWorkspaceIdentity } from "@/lib/office/guard";

export default async function AuthenticatedOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireWorkspaceIdentity("office", "/office/dashboard");
  const permissions = identity.roles.includes("OWNER")
    ? []
    : (await getOfficeCapabilitySnapshot(identity)).permissions;

  return (
    <OfficeWorkspaceShell workspace="office" identity={identity} permissions={permissions}>
      {children}
    </OfficeWorkspaceShell>
  );
}
