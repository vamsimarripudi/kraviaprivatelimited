import { OfficeWorkspaceShell } from "@/components/office-workspace-shell";
import { getOfficeCapabilitySnapshot } from "@/lib/office/capability-server";
import { requireWorkspaceIdentity } from "@/lib/office/guard";

export default async function AuthenticatedOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireWorkspaceIdentity("office", "/office/dashboard");
  const authorization = await getOfficeCapabilitySnapshot(identity);

  return (
    <OfficeWorkspaceShell workspace="office" identity={identity}
      permissions={authorization.permissions} delegatedDepartments={authorization.delegatedDepartments}>
      {children}
    </OfficeWorkspaceShell>
  );
}
