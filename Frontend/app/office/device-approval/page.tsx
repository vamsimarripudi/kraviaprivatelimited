import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { OfficeDeviceApprovalForm } from "@/components/office-device-approval-form";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function OfficeDeviceApprovalPage() {
  return (
    <OfficeAuthLayout
      title="Review this sign-in"
      description="Confirm the exact device before granting Office access."
      footerHref="/office/login"
      footerLabel="Back to sign in"
    >
      <OfficeDeviceApprovalForm />
    </OfficeAuthLayout>
  );
}
