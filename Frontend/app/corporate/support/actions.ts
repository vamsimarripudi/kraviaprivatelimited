"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyCorporateCapability, CorporateAccessError } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";
import { supportPriorities, supportStatuses } from "@/lib/corporate/support";

export type SupportActionResult = { ok: boolean; message: string };
const caseChange = z.object({ caseId: z.string().uuid(), status: z.enum(supportStatuses), priority: z.enum(supportPriorities) });
function failure(error: unknown): SupportActionResult { return { ok: false, message: error instanceof CorporateAccessError ? error.message : "The support case was not changed. Please refresh and try again." }; }
async function requireSupportManagement() { return requireAnyCorporateCapability("support.manage", "support.trust.manage"); }
export async function changeSupportCase(input: unknown): Promise<SupportActionResult> { try {
  await requireSupportManagement(); const values = caseChange.parse(input); const supabase = await createClient(); if (!supabase) return { ok: false, message: "Corporate Office is not configured." };
  const { error } = await supabase.rpc("transition_support_case", { p_case_id: values.caseId, p_status: values.status, p_priority: values.priority, p_assigned_to: null });
  if (error) return { ok: false, message: "The case could not transition. Its state may have changed or your role is not permitted for this queue." };
  revalidatePath("/corporate/support"); revalidatePath("/corporate/dashboard"); return { ok: true, message: "Case workflow updated." };
} catch (error) { return failure(error); } }
export async function claimSupportCase(input: unknown): Promise<SupportActionResult> { try {
  const actor = await requireSupportManagement(); const values = caseChange.parse(input); const supabase = await createClient(); if (!supabase) return { ok: false, message: "Corporate Office is not configured." };
  const { error } = await supabase.rpc("transition_support_case", { p_case_id: values.caseId, p_status: values.status, p_priority: values.priority, p_assigned_to: actor.id });
  if (error) return { ok: false, message: "The case could not be claimed for this queue." };
  revalidatePath("/corporate/support"); return { ok: true, message: "You are now assigned to this case." };
} catch (error) { return failure(error); } }
export async function addSupportUpdate(input: unknown): Promise<SupportActionResult> { try {
  await requireSupportManagement(); const values = z.object({ caseId: z.string().uuid(), body: z.string().trim().min(1).max(5000), customerVisible: z.boolean() }).parse(input); const supabase = await createClient(); if (!supabase) return { ok: false, message: "Corporate Office is not configured." };
  const { error } = await supabase.rpc("add_support_case_update", { p_case_id: values.caseId, p_body: values.body, p_customer_visible: values.customerVisible });
  if (error) return { ok: false, message: "The update could not be recorded for this queue." };
  revalidatePath("/corporate/support"); return { ok: true, message: values.customerVisible ? "Customer-visible update published to the tracking portal." : "Internal case note recorded." };
} catch (error) { return failure(error); } }