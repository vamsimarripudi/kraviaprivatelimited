import { redirect } from "next/navigation";
import { ContentStudio } from "@/components/content-studio";
import { CorporateActivityBeacon } from "@/components/corporate-activity-beacon";
import { CorporateAccessError, requireCorporateCapability } from "@/lib/corporate/authorization";

export const dynamic = "force-dynamic";
export default async function CorporateContentPage() {
  try { await requireCorporateCapability("content.create"); } catch (error) { if (error instanceof CorporateAccessError && error.code === "UNAUTHENTICATED") redirect("/corporate/login?next=/corporate/content"); throw error; }
  return <main className="corporate-workspace"><CorporateActivityBeacon /><ContentStudio /></main>;
}
