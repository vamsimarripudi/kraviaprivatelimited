"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { createClient } from "@/lib/supabase/server";

const settingInput = z.object({
  formKey: z.enum(["CONTACT", "SUPPORT", "TRUST_REQUEST"]),
  title: z.string().trim().max(140).nullable().optional(),
  intro: z.string().trim().max(600).nullable().optional(),
  submitLabel: z.string().trim().max(80).nullable().optional(),
  successHeading: z.string().trim().max(140).nullable().optional(),
  successMessage: z.string().trim().max(600).nullable().optional(),
  isEnabled: z.boolean(),
});

function emptyToNull(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

/** Updates presentation copy only. Request routing, retention and restricted queues stay enforced by the support backend. */
export async function savePublicFormSetting(input: z.input<typeof settingInput>) {
  const actor = await requireCorporateCapability("content.edit");
  const data = settingInput.parse(input);
  const supabase = await createClient();
  if (!supabase) throw new Error("Corporate Office requires Supabase configuration.");
  const values = {
    form_key: data.formKey,
    title: emptyToNull(data.title),
    intro: emptyToNull(data.intro),
    submit_label: emptyToNull(data.submitLabel),
    success_heading: emptyToNull(data.successHeading),
    success_message: emptyToNull(data.successMessage),
    is_enabled: data.isEnabled,
    updated_by: actor.id,
  };
  const { error } = await supabase.from("public_form_settings").upsert(values, { onConflict: "form_key" });
  if (error) throw new Error("The form configuration could not be saved. Apply the Site Control migration and verify your assigned role.");
  await supabase.rpc("write_audit_event", {
    p_action: "PUBLIC_FORM_CONFIGURATION_UPDATED",
    p_entity_type: "public_form_setting",
    p_entity_id: null,
    p_context: { form_key: data.formKey, enabled: data.isEnabled, aal: actor.aal },
  });
  revalidatePath("/contact");
  revalidatePath("/support");
  revalidatePath("/privacy-request");
  revalidatePath("/trust/security-reporting");
  revalidatePath("/admin/forms");
  return { ok: true };
}
