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
  status: "ACTIVE" | "BETA" | "PRIVATE" | "ACQUIRED" | "DISCONTINUED" | "ARCHIVED";
  public: boolean;
  website?: string;
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

export const publicCompanyInformation = {
  legalName: {
    value: "KRAVIA PRIVATE LIMITED",
    visibility: "PUBLIC",
    verificationStatus: "PUBLIC_APPROVED",
  },
  displayName: {
    value: "Kravia",
    visibility: "PUBLIC",
    verificationStatus: "PUBLIC_APPROVED",
  },
  entityType: {
    value: "Private Limited Company",
    visibility: "PUBLIC",
    verificationStatus: "PUBLIC_APPROVED",
  },
  country: {
    value: "India",
    visibility: "PUBLIC",
    verificationStatus: "PUBLIC_APPROVED",
  },
  incorporationDate: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  cin: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  registeredOffice: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  telephone: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  email: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  grievanceContact: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  gstRegistered: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
  gstin: { value: null, visibility: "PUBLIC", verificationStatus: "UNVERIFIED" },
} as const satisfies Record<string, GovernedField<string | boolean>>;

export const publicProducts: readonly KraviaProduct[] = [
  {
    id: "vidyaluma",
    slug: "vidyaluma",
    name: "VidyaLuma",
    category: "Education technology",
    description: "AI-powered school and academic intelligence platform.",
    status: "ACTIVE",
    public: true,
    order: 1,
  },
];

// This remains deliberately empty until evidence-backed events are approved.
export const publicCompanyMilestones: readonly CompanyMilestone[] = [];

export const companyNarrative = {
  summary:
    "Kravia Private Limited is an Indian technology company building software products, intelligent systems and digital infrastructure for organisations that need simpler, safer and more connected ways to work.",
  purpose:
    "Complex systems should feel clear to the people who depend on them.",
  mission:
    "Build useful technology that helps organisations work with greater clarity, confidence and continuity.",
  vision:
    "A future where capable technology removes unnecessary complexity without removing human judgement.",
  principles: [
    ["Build for usefulness", "Start with the work people need to do, not a feature list."],
    ["Make complexity disappear", "Design systems that make difficult work easier to understand and act on."],
    ["Earn trust", "Treat privacy, security and accountability as part of the product."],
    ["Engineer for the long term", "Make choices that retain their value beyond a single release."],
    ["Use intelligence responsibly", "Keep purpose, limitations and human oversight visible."],
  ],
} as const;
