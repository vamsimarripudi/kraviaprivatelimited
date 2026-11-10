/**
 * KRAVIA's approved public-facing contact aliases.
 *
 * The complete 30-alias Google Workspace register and internal-only purposes
 * are documented in docs/company-email-alias-register.md. Only these aliases
 * may be advertised on the public corporate website. Product domains keep
 * their own contact identities.
 *
 * Alias provisioning has been confirmed by the owner; this is not a delivery
 * verification or a separate access-control boundary.
 */
export const publicCorporateEmails = {
  contact: "contact@kraviaprivatelimited.com",
  partnerships: "partnerships@kraviaprivatelimited.com",
  products: "products@kraviaprivatelimited.com",
  demos: "demos@kraviaprivatelimited.com",
  feedback: "feedback@kraviaprivatelimited.com",
  support: "support@kraviaprivatelimited.com",
  legal: "legal@kraviaprivatelimited.com",
  billing: "billing@kraviaprivatelimited.com",
  careers: "careers@kraviaprivatelimited.com",
  press: "press@kraviaprivatelimited.com",
  accessibility: "accessibility@kraviaprivatelimited.com",
} as const;

/**
 * Do not expose shared-inbox aliases as a substitute for restricted privacy,
 * grievance or security workflows.
 */
export function publicEnquiryEmail(category: string): string | null {
  if (["Security", "Privacy", "Privacy question", "Grievance"].includes(category)) {
    return null;
  }
  const byCategory: Record<string, string> = {
    "Business enquiry": publicCorporateEmails.contact,
    "Product enquiry": publicCorporateEmails.products,
    Partnership: publicCorporateEmails.partnerships,
    "Media / corporate enquiry": publicCorporateEmails.press,
    Careers: publicCorporateEmails.careers,
    General: publicCorporateEmails.contact,
  };
  return byCategory[category] ?? publicCorporateEmails.contact;
}
