import { redirect } from "next/navigation";
import { CorporateActivityBeacon } from "@/components/corporate-activity-beacon";
import { DocumentUploadForm } from "@/components/document-upload-form";
import { CorporateAccessError, requireCorporateCapability } from "@/lib/corporate/authorization";

export const dynamic = "force-dynamic";
export default async function CorporateDocumentsPage() {
  try { await requireCorporateCapability("document.upload"); } catch (error) { if (error instanceof CorporateAccessError && error.code === "UNAUTHENTICATED") redirect("/corporate/login?next=/corporate/documents"); throw error; }
  return <main className="corporate-workspace"><CorporateActivityBeacon /><DocumentUploadForm /></main>;
}
