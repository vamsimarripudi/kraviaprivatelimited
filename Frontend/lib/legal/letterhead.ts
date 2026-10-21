import { publicCompanyInformation } from "../corporate-content";

/**
 * The mandatory company-stationery particulars used only in KRAVIA's printed
 * legal documents. They are intentionally separate from public-company page
 * copy: a print letterhead needs the Companies Act section 12(3)(c) fields,
 * while a public page has its own approval and disclosure boundaries.
 *
 * Do not add a fax number, former name, PAN, TAN, bank details, or invoice
 * fields here unless they are both applicable and approved for this document.
 */
export const kraviaLetterheadProfile = {
  legalName: publicCompanyInformation.legalName.value,
  registeredOffice: publicCompanyInformation.registeredOffice.value,
  cin: publicCompanyInformation.cin.value,
  // This is the company contact number shown on the approved supplied
  // letterhead. A mobile contact is still a telephone number for display.
  telephone: "+91 70139 81759",
  email: "corporate@kraviaprivatelimited.com",
  website: "www.kraviaprivatelimited.com",
} as const;

export const kraviaLetterheadContactLine = [
  kraviaLetterheadProfile.legalName,
  `CIN: ${kraviaLetterheadProfile.cin}`,
  `TEL: ${kraviaLetterheadProfile.telephone}`,
  `EMAIL: ${kraviaLetterheadProfile.email}`,
  `WEB: ${kraviaLetterheadProfile.website}`,
].join("  |  ");
