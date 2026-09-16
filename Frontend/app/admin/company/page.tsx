import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-console";
import { CorporateFactsEditor } from "@/components/corporate-facts-editor";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";
import type { PublicFactKey } from "@/lib/corporate/facts-schema";

type CorporateFactRow = { id: string; fact_key: PublicFactKey; value: unknown; visibility: "PUBLIC" | "PRIVATE"; verification_status: string; effective_from: string | null; verification_source: string | null; updated_at: string };

export default async function AdminCompanyFactsPage() {
  await requireCorporateCapability("content.facts.manage");
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("corporate_facts").select("id,fact_key,value,visibility,verification_status,effective_from,verification_source,updated_at").order("updated_at", { ascending: false }).limit(30) : { data: [] };
  return <section className="admin-page">
    <AdminPageHeader eyebrow="COMPANY FACT GOVERNANCE" title="One record for every public company fact." intro="Record the value, evidence, verification state, and effective date once. Public pages and structured data consume only the approved projection."><Link className="button button-light" href="/company/corporate-information" target="_blank" rel="noreferrer">View public facts <ArrowUpRight /></Link></AdminPageHeader>
    <CorporateFactsEditor facts={(data ?? []) as CorporateFactRow[]} />
  </section>;
}