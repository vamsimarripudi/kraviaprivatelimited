import { notFound, redirect } from "next/navigation";
import { CorporateOfficeScreen } from "@/components/corporate-office-screen";
import { officeSections, type OfficeSection } from "@/lib/corporate/office";
import { createClient } from "@/lib/supabase/server";
import type { CorporateRole } from "@/lib/corporate/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ section: string }> };

export default async function CorporateSectionPage({ params }: Props) {
  const { section } = await params;
  if (!(section in officeSections)) notFound();
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/corporate/login");
  const { data: profile } = await supabase!.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return <CorporateOfficeScreen section={section as OfficeSection} email={user.email} role={profile?.is_active === false ? undefined : profile?.role as CorporateRole | undefined} />;
}
