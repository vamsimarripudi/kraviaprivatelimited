import { redirect } from "next/navigation";
import { CorporateProfileSettings } from "@/components/corporate-profile-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CorporateSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user?.email) redirect("/corporate/login?next=/corporate/settings");
  const { data: profile } = await supabase!.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : profile?.full_name ?? "";
  return <CorporateProfileSettings email={user.email} fullName={fullName} role={profile?.role ?? null} />;
}
