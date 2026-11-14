import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

export default async function FinanceLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/finance") ? next : "/finance/dashboard";
  return (
    <OfficeAuthLayout eyebrow="FINANCE / RESTRICTED" title="KRAVIA Finance"
      description="A controlled Finance and Tax workspace. Your roles, session assurance and action-specific permissions continue to be verified by KRAVIA Office.">
      <div className="office5-finance-assurance" aria-label="Finance access controls">
        <span>Role scoped</span><span>AAL2 required</span><span>Evidence first</span>
      </div>
      <WorkspaceLoginForm workspace="finance" nextPath={nextPath}
        configurationRequired={!getOfficeRuntimeOrigin()} reason={reason} />
    </OfficeAuthLayout>
  );
}
