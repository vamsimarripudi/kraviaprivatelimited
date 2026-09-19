import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { founderBootstrapStatus } from "@/lib/office/auth-server";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

function recoveryNotice(reason?: string) {
  if (reason === "recovery_invalid") return "That recovery request is invalid. Contact an Office administrator.";
  return undefined;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficeLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/office") ? next : "/office/dashboard";
  const notice = recoveryNotice(reason);
  let registrationOpen = false;
  try {
    registrationOpen = (await founderBootstrapStatus()).registration_open;
  } catch {
    registrationOpen = false;
  }

  return (
    <OfficeAuthLayout>
      {notice ? <p role="status">{notice}</p> : null}
      <WorkspaceLoginForm
        workspace="office"
        nextPath={nextPath}
        configurationRequired={!getOfficeRuntimeOrigin()}
        reason={reason}
        registrationOpen={registrationOpen}
      />
    </OfficeAuthLayout>
  );
}
