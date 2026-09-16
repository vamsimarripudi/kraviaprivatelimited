import "server-only";

import { cache } from "react";
import { publicCompanyInformation } from "@/lib/corporate-content";
import { createClient } from "@/lib/supabase/server";

import { publicFactKeys, type PublicFactKey } from "./facts-schema";

export type PublicCompanyProfile = {
  legalName: string | null;
  displayName: string | null;
  companyType: string | null;
  country: string | null;
  incorporationDate: string | null;
  cin: string | null;
  registeredOffice: string | null;
  telephone: string | null;
  corporateEmail: string | null;
  grievanceContact: string | null;
  gst: { registered: boolean | null; gstin: string | null };
};

type FactRow = { fact_key: PublicFactKey; value: unknown };

export const fallbackPublicCompanyProfile: PublicCompanyProfile = {
  legalName: publicCompanyInformation.legalName.value,
  displayName: publicCompanyInformation.displayName.value,
  companyType: publicCompanyInformation.entityType.value,
  country: publicCompanyInformation.country.value,
  incorporationDate: publicCompanyInformation.incorporationDate.value,
  cin: publicCompanyInformation.cin.value,
  registeredOffice: publicCompanyInformation.registeredOffice.value,
  telephone: publicCompanyInformation.telephone.value,
  corporateEmail: publicCompanyInformation.email.value,
  grievanceContact: publicCompanyInformation.grievanceContact.value,
  gst: { registered: publicCompanyInformation.gstRegistered.value, gstin: publicCompanyInformation.gstin.value },
};

function asString(value: unknown, fallback: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean | null) {
  return typeof value === "boolean" ? value : fallback;
}

function profileFromRows(rows: readonly FactRow[]): PublicCompanyProfile {
  const values = new Map(rows.map((row) => [row.fact_key, row.value]));
  return {
    legalName: asString(values.get("legal_name"), fallbackPublicCompanyProfile.legalName),
    displayName: asString(values.get("display_name"), fallbackPublicCompanyProfile.displayName),
    companyType: asString(values.get("entity_type"), fallbackPublicCompanyProfile.companyType),
    country: asString(values.get("country"), fallbackPublicCompanyProfile.country),
    incorporationDate: asString(values.get("incorporation_date"), fallbackPublicCompanyProfile.incorporationDate),
    cin: asString(values.get("cin"), fallbackPublicCompanyProfile.cin),
    registeredOffice: asString(values.get("registered_office"), fallbackPublicCompanyProfile.registeredOffice),
    telephone: asString(values.get("telephone"), fallbackPublicCompanyProfile.telephone),
    corporateEmail: asString(values.get("email"), fallbackPublicCompanyProfile.corporateEmail),
    grievanceContact: asString(values.get("grievance_contact"), fallbackPublicCompanyProfile.grievanceContact),
    gst: {
      registered: asBoolean(values.get("gst_registered"), fallbackPublicCompanyProfile.gst.registered),
      gstin: asString(values.get("gstin"), fallbackPublicCompanyProfile.gst.gstin),
    },
  };
}

/** Reads only the database's explicit public projection. Failed/absent configuration keeps the non-sensitive fallback. */
export const getPublicCompanyProfile = cache(async (): Promise<PublicCompanyProfile> => {
  const supabase = await createClient();
  if (!supabase) return fallbackPublicCompanyProfile;
  const { data, error } = await supabase.rpc("public_corporate_facts");
  if (error || !data) return fallbackPublicCompanyProfile;
  return profileFromRows(data as FactRow[]);
});