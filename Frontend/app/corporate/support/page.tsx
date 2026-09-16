import { redirect } from "next/navigation";
import { CorporateOfficeScreen } from "@/components/corporate-office-screen";
import { SupportOperations } from "@/components/support-operations";
import { requireAnyCorporateCapability, CorporateAccessError } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";
import { hasCapability } from "@/lib/corporate/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CorporateSupportPage() {
  let actor;
  try { actor = await requireAnyCorporateCapability("support.view", "support.trust.view"); }
  catch (error) { if (error instanceof CorporateAccessError && error.code === "UNAUTHENTICATED") redirect("/corporate/login"); throw error; }
  const supabase = await createClient();
  if (!supabase) redirect("/corporate/login");
  const { data } = await supabase.from("support_cases").select("id,reference,category,queue,request_kind,subject,status,priority,assigned_to,created_at,updated_at,version").neq("status", "CLOSED").order("priority", { ascending: false }).order("updated_at", { ascending: false }).limit(100);
  const canManage = hasCapability(actor.role, "support.manage") || hasCapability(actor.role, "support.trust.manage");
  return <CorporateOfficeScreen section="support" email={actor.email} role={actor.role}><SupportOperations cases={(data ?? []) as never[]} canManage={canManage} /></CorporateOfficeScreen>;
}