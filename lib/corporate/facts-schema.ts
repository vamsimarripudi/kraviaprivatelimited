export const publicFactKeys = [
  "legal_name",
  "display_name",
  "entity_type",
  "country",
  "incorporation_date",
  "cin",
  "registered_office",
  "telephone",
  "email",
  "grievance_contact",
  "gst_registered",
  "gstin",
] as const;

export type PublicFactKey = (typeof publicFactKeys)[number];

export const publicFactLabels: Record<PublicFactKey, string> = {
  legal_name: "Legal name",
  display_name: "Display name",
  entity_type: "Entity type",
  country: "Country",
  incorporation_date: "Incorporation date",
  cin: "CIN",
  registered_office: "Registered office",
  telephone: "Telephone",
  email: "Corporate email",
  grievance_contact: "Grievance contact",
  gst_registered: "GST registration status",
  gstin: "GSTIN",
};