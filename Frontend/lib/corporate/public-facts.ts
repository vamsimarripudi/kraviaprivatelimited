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

function profileFromRows(rows: readonly FactRow[]): PublicCompanyProfile {
  const values = new Map(rows.map((row) => [row.fact_key, row.value]));
  return {
    // The public identity file is the approved source for statutory facts.
    // A database record cannot silently supersede a reviewed CIN, tax ID or
    // registered office; only the optional grievance-contact projection remains
    // governed dynamically.
    legalName: fallbackPublicCompanyProfile.legalName,
    displayName: fallbackPublicCompanyProfile.displayName,
    companyType: fallbackPublicCompanyProfile.companyType,
    country: fallbackPublicCompanyProfile.country,
    incorporationDate: fallbackPublicCompanyProfile.incorporationDate,
    cin: fallbackPublicCompanyProfile.cin,
    registeredOffice: fallbackPublicCompanyProfile.registeredOffice,
    telephone: fallbackPublicCompanyProfile.telephone,
    corporateEmail: fallbackPublicCompanyProfile.corporateEmail,
    grievanceContact: asString(values.get("grievance_contact"), fallbackPublicCompanyProfile.grievanceContact),
    gst: fallbackPublicCompanyProfile.gst,
  };
}

/** Returns the reviewed static identity and, when configured, a separately governed grievance contact. */
export const getPublicCompanyProfile = cache(async (): Promise<PublicCompanyProfile> => {
  const supabase = await createClient();
  if (!supabase) return fallbackPublicCompanyProfile;
  const { data, error } = await supabase.rpc("public_corporate_facts");
  if (error || !data) return fallbackPublicCompanyProfile;
  return profileFromRows(data as FactRow[]);
});
