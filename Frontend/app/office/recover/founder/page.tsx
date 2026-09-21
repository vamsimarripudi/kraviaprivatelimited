import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { OfficeFounderRecoveryForm } from "@/components/office-founder-recovery-form";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default function FounderRecoveryPage() {
  return <OfficeAuthLayout
    title="Founder break-glass recovery"
    description="Emergency recovery for the protected KRAVIA Office Founder identity."
    footerHref="/office/recover"
    footerLabel="Back to recovery options"
  >
    <OfficeFounderRecoveryForm />
  </OfficeAuthLayout>;
}
