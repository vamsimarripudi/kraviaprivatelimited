import { redirect } from "next/navigation";
import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { OfficeDeviceApprovalForm } from "@/components/office-device-approval-form";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

type SearchParams = Promise<{ review?: string | string[] }>;

export default async function OfficeDeviceApprovalPage({ searchParams }: { searchParams: SearchParams }) {
  const { review } = await searchParams;
  if (review !== "approve" && review !== "decline") redirect("/office/login?reason=device_approval_invalid");
  return (
    <OfficeAuthLayout
      title="Review KRAVIA Office device"
      description="An account-owner decision for a new browser request."
      footerHref="/office/login"
      footerLabel="Back to sign in"
    >
      <OfficeDeviceApprovalForm decision={review} />
    </OfficeAuthLayout>
  );
}
