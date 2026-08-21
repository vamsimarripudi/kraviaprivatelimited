import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { CorporateActivityBeacon } from "@/components/corporate-activity-beacon";
import { CorporateAccessError, requireAnyCorporateCapability } from "@/lib/corporate/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site Control", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    const actor = await requireAnyCorporateCapability("content.view", "support.view", "security.manage", "readiness.view", "automation.view");
    return <AdminConsole actor={actor}><CorporateActivityBeacon />{children}</AdminConsole>;
  } catch (error) {
    if (error instanceof CorporateAccessError && error.code === "UNAUTHENTICATED") redirect("/corporate/login?next=/admin");
    throw error;
  }
}