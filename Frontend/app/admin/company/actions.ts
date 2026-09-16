"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCorporateCapability } from "@/lib/corporate/authorization";
import { publicFactKeys } from "@/lib/corporate/facts-schema";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  factKey: z.enum(publicFactKeys),
  value: z.string().trim().min(1).max(2000),
  verificationStatus: z.enum(["UNVERIFIED", "DOCUMENT_VERIFIED", "PROFESSIONAL_VERIFIED", "DIRECTOR_APPROVED", "PUBLIC_APPROVED"]),
  verificationSource: z.string().trim().min(3).max(500),
  effectiveFrom: z.string().date().optional(),
});

export async function createCorporateFact(input: z.input<typeof inputSchema>) {
  const actor = await requireCorporateCapability("content.facts.manage");
  const data = inputSchema.parse(input);
  const isBoolean = data.factKey === "gst_registered";
  if (isBoolean && data.value !== "true" && data.value !== "false") throw new Error("GST registration status must be true or false.");
  if (data.verificationStatus === "PUBLIC_APPROVED" && !data.verificationSource) throw new Error("Public facts require an evidence or approval source.");
  const supabase = await createClient();
  if (!supabase) throw new Error("Corporate Office requires Supabase configuration.");
  const value = isBoolean ? data.value === "true" : data.value;
  const { error } = await supabase.from("corporate_facts").insert({
    fact_key: data.factKey,
    value,
    visibility: data.verificationStatus === "PUBLIC_APPROVED" ? "PUBLIC" : "PRIVATE",
    verification_status: data.verificationStatus,
    verification_source: data.verificationSource,
    verified_by: actor.id,
    verified_at: new Date().toISOString(),
    effective_from: data.effectiveFrom || new Date().toISOString().slice(0, 10),
    last_reviewed_at: new Date().toISOString(),
    created_by: actor.id,
    updated_by: actor.id,
  });
  if (error) throw new Error("The corporate fact could not be recorded.");
  revalidatePath("/");
  revalidatePath("/company");
  revalidatePath("/company/corporate-information");
  revalidatePath("/sitemap.xml");
}