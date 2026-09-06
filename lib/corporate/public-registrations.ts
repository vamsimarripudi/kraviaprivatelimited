import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const registrationPresentation = {
  startup_india_recognition: { authority: "Government of India · DPIIT", title: "Startup India recognition", href: "https://www.startupindia.gov.in/content/sih/en/startupgov/validate-startup-recognition.html" },
  udyam_registration: { authority: "Government of India · Ministry of MSME", title: "Udyam registration", href: "https://udyamregistration.gov.in/SearchRegDetail.aspx" },
  cin: { authority: "Government of India · Ministry of Corporate Affairs", title: "Corporate Identity Number", href: "https://www.mca.gov.in/" },
  gstin: { authority: "Government of India · Goods and Services Tax", title: "GST Identification Number", href: "https://services.gst.gov.in/services/searchtp" },
} as const;

type RegistrationKey = keyof typeof registrationPresentation;
type FactRow = { fact_key: string; value: unknown };
export type PublicCorporateRegistration = { authority: string; title: string; reference: string; href: string };

export const getPublicCorporateRegistrations = cache(async (): Promise<readonly PublicCorporateRegistration[]> => {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("public_corporate_facts");
  if (error || !data) return [];
  const records = new Map((data as FactRow[]).filter((row) => typeof row.value === "string").map((row) => [row.fact_key, row.value as string]));
  return (Object.keys(registrationPresentation) as RegistrationKey[]).flatMap((key) => {
    const reference = records.get(key);
    return reference ? [{ ...registrationPresentation[key], reference }] : [];
  });
});
