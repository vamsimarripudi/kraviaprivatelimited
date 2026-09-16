import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PublicFormKey, PublicFormSetting } from "@/lib/admin/site-control-types";

type FormSettingRow = {
  form_key: PublicFormKey;
  title: string | null;
  intro: string | null;
  submit_label: string | null;
  success_heading: string | null;
  success_message: string | null;
  is_enabled: boolean;
  updated_at: string;
};

function mapFormSetting(row: FormSettingRow): PublicFormSetting {
  return {
    formKey: row.form_key,
    title: row.title,
    intro: row.intro,
    submitLabel: row.submit_label,
    successHeading: row.success_heading,
    successMessage: row.success_message,
    isEnabled: row.is_enabled,
    updatedAt: row.updated_at,
  };
}

/** Public-only presentation copy. This table contains no routing rules, contact data, or confidential request data. */
export async function getPublicFormSetting(formKey: PublicFormKey): Promise<PublicFormSetting | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("public_form_settings")
    .select("form_key,title,intro,submit_label,success_heading,success_message,is_enabled,updated_at")
    .eq("form_key", formKey)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error || !data) return null;
  return mapFormSetting(data as FormSettingRow);
}

export async function listManagedFormSettings(): Promise<{ schemaReady: boolean; settings: PublicFormSetting[] }> {
  const supabase = await createClient();
  if (!supabase) return { schemaReady: false, settings: [] };
  const { data, error } = await supabase
    .from("public_form_settings")
    .select("form_key,title,intro,submit_label,success_heading,success_message,is_enabled,updated_at")
    .order("form_key");
  if (error) return { schemaReady: false, settings: [] };
  return { schemaReady: true, settings: (data as FormSettingRow[]).map(mapFormSetting) };
}
