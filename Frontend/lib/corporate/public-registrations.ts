import "server-only";

import { cache } from "react";
import { corporateIdentity } from "@/lib/corporate-content";

export type PublicCorporateRegistration = {
  authority: string;
  title: string;
  reference: string;
  href: string;
  description: string;
};

/**
 * Compact public presentation only. Certificate originals, source contacts and
 * other evidence stay inside the access-controlled Corporate Office.
 */
const approvedPublicRegistrations: readonly PublicCorporateRegistration[] = [
  {
    authority: "Startup India",
    title: corporateIdentity.dpiit.statusLabel,
    reference: corporateIdentity.dpiit.recognitionNumber,
    href: "https://www.startupindia.gov.in/content/sih/en/startupgov/validate-startup-recognition.html",
    description: "Recognition by DPIIT for the company. It is not product certification, endorsement, grant or tax-exemption status.",
  },
  {
    authority: "Udyam MSME",
    title: corporateIdentity.udyam.classification,
    reference: corporateIdentity.udyam.registrationNumber,
    href: "https://udyamregistration.gov.in/SearchRegDetail.aspx",
    description: "MSME registration for the company. It is not a product-quality, procurement or service-performance claim.",
  },
];

export const getPublicCorporateRegistrations = cache(async (): Promise<readonly PublicCorporateRegistration[]> => {
  return approvedPublicRegistrations;
});
