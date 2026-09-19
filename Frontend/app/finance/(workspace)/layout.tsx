import { OfficeWorkspaceShell } from "@/components/office-workspace-shell";
import { getOfficeCapabilitySnapshot } from "@/lib/office/capability-server";
import { requireWorkspaceIdentity } from "@/lib/office/guard";

export default async function AuthenticatedFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireWorkspaceIdentity("finance", "/finance/dashboard");
  const permissions = identity.roles.includes("OWNER")
    ? []
    : (await getOfficeCapabilitySnapshot(identity)).permissions;

  return (
    <OfficeWorkspaceShell workspace="finance" identity={identity} permissions={permissions}>
      {children}
    </OfficeWorkspaceShell>
  );
}
