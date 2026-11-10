import { recruitFlowProduct } from "./products/recruitflow";
import { vidyaLumaProduct } from "./products/vidyaluma";
import { vorioProduct } from "./products/vorio";
import { yuktaProduct } from "./products/yukta";

export type VerificationStatus =
  | "UNVERIFIED"
  | "DOCUMENT_VERIFIED"
  | "PROFESSIONAL_VERIFIED"
  | "DIRECTOR_APPROVED"
  | "PUBLIC_APPROVED";

export type GovernedField<T> = {
  value: T | null;
  visibility: "PUBLIC" | "PRIVATE";
  verificationStatus: VerificationStatus;
  lastReviewedAt?: string;
};

export type KraviaProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  status: "ACTIVE" | "BETA" | "COMING_SOON" | "PRIVATE" | "ACQUIRED" | "DISCONTINUED" | "ARCHIVED";
  public: boolean;
  href?: string;
  website?: string;
  enquiryCategory?: string;
  order: number;
};

export type CompanyMilestone = {
  id: string;
  date: string | null;
  title: string;
  description: string;
  category: string;
  public: boolean;
  verificationStatus: VerificationStatus;
};

/**
 * Single approved public identity source. Certificate originals remain private
 * evidence; this record contains only values approved for the public site.
 */
export const corporateIdentity = {
  legalName: "KRAVIA PRIVATE LIMITED",
  displayName: "Kravia",
  entityType: "Private Limited Company",
  country: "India",
  incorporationDate: "2026-07-01",
  cin: "U62011AP2026PTC126691",
  pan: "AANCK0043M",
  gstin: "37AANCK0043M1ZA",
  registeredOffice: {
    line1: "4-340, Salipeta",
    locality: "Malikipuram",
    state: "Andhra Pradesh",
    postalCode: "533253",
    country: "India",
    formatted: "4-340, Salipeta, Malikipuram, Andhra Pradesh – 533253, India",
  },
  contact: {
    email: "hello@kraviaprivatelimited.com",
    telephone: "+91 70139 81759",
  },
  dpiit: {
    recognitionNumber: "DIPP281524",
    statusLabel: "DPIIT Recognised Startup",
  },
  udyam: {
    registrationNumber: "UDYAM-AP-18-0057505",
    classification: "Registered Micro Enterprise",
  },
} as const;

export const publicCompanyInformation = {
  legalName: { value: corporateIdentity.legalName, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED" },
  displayName: { value: corporateIdentity.displayName, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED" },
  entityType: { value: corporateIdentity.entityType, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED" },
  country: { value: corporateIdentity.country, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED" },
  incorporationDate: { value: corporateIdentity.incorporationDate, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-21" },
  cin: { value: corporateIdentity.cin, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-21" },
  registeredOffice: { value: corporateIdentity.registeredOffice.formatted, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-21" },
  telephone: { value: corporateIdentity.contact.telephone, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-21" },
  email: { value: corporateIdentity.contact.email, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-21" },
  grievanceContact: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  gstRegistered: { value: true, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-04" },
  gstin: { value: corporateIdentity.gstin, visibility: "PUBLIC", verificationStatus: "PUBLIC_APPROVED", lastReviewedAt: "2026-10-21" },
} as const satisfies Record<string, GovernedField<string | boolean>>;

export const publicProducts: readonly KraviaProduct[] = [
  vidyaLumaProduct,
  recruitFlowProduct,
  yuktaProduct,
  vorioProduct,
];

// This remains deliberately empty until evidence-backed events are approved.
export const publicCompanyMilestones: readonly CompanyMilestone[] = [];

export const companyNarrative = {
  summary: "KRAVIA PRIVATE LIMITED is an independent Indian software product company. We develop and operate our own technology platforms, led by VidyaLuma for schools, with subscriptions and software licensing as our intended commercial model.",
  purpose: "Our own software products, built for real operational needs.",
  mission: "Develop and operate proprietary software platforms that simplify important work for the people using them.",
  vision: "A scalable portfolio of independently branded software products, built for long-term usefulness and accountable operation.",
  principles: [
    ["Build for usefulness", "Start with the work people need to do, not a feature list."],
    ["Make complexity disappear", "Design systems that make difficult work easier to understand and act on."],
    ["Earn trust", "Treat privacy, security and accountability as part of the product."],
    ["Engineer for the long term", "Make choices that retain their value beyond a single release."],
    ["Use intelligence responsibly", "Keep purpose, limitations and human oversight visible."],
  ],
} as const;
