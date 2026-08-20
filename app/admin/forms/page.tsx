import Link from "next/link";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-console";
import { AdminFormSettings } from "@/components/admin-form-settings";
import { listManagedFormSettings } from "@/lib/admin/site-control";
import { requireCorporateCapability } from "@/lib/corporate/authorization";

export default async function AdminFormsPage() {
  await requireCorporateCapability("content.edit");
  const formState = await listManagedFormSettings();
  return <section className="admin-page">
    <AdminPageHeader eyebrow="PUBLIC FORM GOVERNANCE" title="Make the route clearer. Keep the data boundary intact." intro="Update the public wording that people see before they submit. The database-controlled support, privacy and security queues remain separate from this presentation layer."><Link className="button button-light" href="/corporate/support"><LockKeyhole /> Open request operations <ArrowUpRight /></Link></AdminPageHeader>
    <AdminFormSettings {...formState} />
  </section>;
}