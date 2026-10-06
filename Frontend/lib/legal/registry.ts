import type { LegalCandidateDocument, LegalDocumentGroup } from "./types";

type CandidateSeed = Omit<LegalCandidateDocument, "status" | "publish" | "approvedContentSha256">;

// This registry contains only stable, non-sensitive release metadata from the
// supplied review pack. It deliberately omits candidate policy bodies: review
// drafts must enter the private, audited content workflow before a reader or a
// downloadable artifact can receive them.
const candidateSeeds = [
  ["P01", "Trust Charter and Company Information", "trust-charter", "COMPANY_AND_TRUST", "582c0679f14d0e02075b717ff119396a5e2c9bef06bc1d5e0614fc18ec54dd60", ["company_identifiers", "functional_inboxes", "approved_claims", "product_scope"]],
  ["P02", "Global Privacy Policy", "privacy", "PRIVACY_AND_DATA_RIGHTS", "d50f0f19c26ebb85f6b5a04f0485382598db541121e02a122a445a2e308d20b1", ["data_map", "registration_necessity", "vendors", "retention", "rights_workflow", "inboxes", "ai_no_training"]],
  ["P03", "Terms of Use and Service", "terms", "COMMERCIAL_TERMS", "a6ce53be10ac602958a93a4c25c1f66e39e89d63dbb5622985cf5241027ec172", ["contract_acceptance", "consumer_terms", "grievance_identity", "commercial_configuration", "counsel_approval"]],
  ["P04", "AI Usage and Responsible AI Policy", "ai-policy", "AI_AND_ACCEPTABLE_USE", "92affce161f99699c3facbf0f81cc6996a73a04980982159683bc38dc235bac2", ["ai_no_training", "ai_model_register", "ai_safety_evaluation", "ai_memory", "human_review"]],
  ["P05", "Acceptable Use Policy", "acceptable-use", "AI_AND_ACCEPTABLE_USE", "906a717f7daafce5bd580c46f11a6db7ef8ef038ac36238524e64ab221e4f44d", ["enforcement_workflow", "appeals", "product_scope"]],
  ["P06", "General Disclaimer", "disclaimer", "COMPANY_AND_TRUST", "e62d360dc72d498be0d9334792b91b8b738b29557cca14280af1b5ad91930249", ["claims_review", "product_scope"]],
  ["P07", "Cookie and Tracking Technologies Policy", "cookies", "PRIVACY_AND_DATA_RIGHTS", "9b7896d52bd88e898f0ac6ccf0bde7270e5b7c5dc0563c0b271dcd360179e204", ["cookie_inventory", "cmp_network_tests", "gpc"]],
  ["P08", "Billing, Subscriptions, Cancellation and Refund Policy", "billing-refunds", "COMMERCIAL_TERMS", "e774bf6d6a54ed75639e54769e563bd758966d37d14ac26f8276d92fa284dede", ["checkout", "payment_providers", "refund_workflow", "grace_configuration", "renewal_notices"]],
  ["P09", "Data Rights and Privacy Requests Policy", "data-rights", "PRIVACY_AND_DATA_RIGHTS", "1810b4bffc6c8382f1315b39f47a5800b99d99c8706f1f58860785f050a94862", ["rights_workflow", "deadlines", "verification", "export_delete"]],
  ["P10", "Data Retention and Deletion Policy", "retention-deletion", "PRIVACY_AND_DATA_RIGHTS", "822b7ae3bce2cfd9c4363c0143f85c9b2ca57fe8ff9b691a1977b7e9497e65a8", ["retention_schedule", "backup_period", "statutory_retention", "deletion_jobs"]],
  ["P11", "Security and Service Reliability Statement", "security", "SECURITY_AND_REPORTING", "6b90f9464e491e573d2ba41c454d14b864d26f60b6ff426b186479e395cb083c", ["security_evidence", "incident_runbook", "recovery_tests", "assurance_scope"]],
  ["P12", "Vulnerability Disclosure Policy", "vulnerability-disclosure", "SECURITY_AND_REPORTING", "74a5d83b6ab699a90ea42d5f4322577a8a5783af4fa93953c702c919044726ae", ["security_inbox", "vdp_scope", "triage_owner"]],
  ["P13", "Subprocessors and Service Provider Transparency Notice", "subprocessors", "PRIVACY_AND_DATA_RIGHTS", "499cc82b3bde9ae3a92ecb16ee3689396ed239308d8d62ef42069cf46aadf7c7", ["vendors", "role_mapping", "regions", "dpa_notices"]],
  ["P14", "Electronic Communications and Anti-Spam Policy", "communications", "AI_AND_ACCEPTABLE_USE", "6121e66692a80b9946ecbd2e996ef3eb98f1467c1f7b95c1bd5832c781b3154a", ["marketing_consent", "suppression", "channel_controls"]],
  ["P15", "Intellectual Property and Copyright Complaints Policy", "intellectual-property", "COMPANY_AND_TRUST", "e476806f4b55db05367d798e714dc233426b940b61e91a5e7e9316bc1f254a00", ["ip_process", "agent_applicability", "legal_inbox"]],
  ["P16", "Accessibility Statement", "accessibility", "COMPANY_AND_TRUST", "6800a4767ff353358d981b2a81352db7b791573f056633c33f123328c01ab1da", ["accessibility_audit", "support_inbox"]],
  ["P17", "Grievance, Complaints and Appeals Policy", "grievance", "PRIVACY_AND_DATA_RIGHTS", "24fb01fe9d985930bd9ab401f349534cf50a14d75f632a50f130d8e23df3acea", ["grievance_identity", "deadline_routing", "appeal_workflow"]],
  ["P18", "Product Discontinuation and Service Sunset Policy", "product-sunset", "COMMERCIAL_TERMS", "d5de926c35cca8bbe8443502d2fc0385e9c19199c3b25668dde58962d04cb04b", ["sunset_runbook", "export_delete", "billing_remedies"]],
  ["P19", "Beta, Early Access and User Research Policy", "beta-research", "AI_AND_ACCEPTABLE_USE", "840410333ca5b2748ef59404fec9de1e0f3351ea84101f3cebf9febd673e2c7a", ["research_consent", "beta_scope", "recording_controls"]],
  ["P20", "Government Requests and Business Transfers Notice", "legal-requests-transfers", "COMPANY_AND_TRUST", "6de3133a67f786afcf833bf46eaa20b93cd34a58ba2ab84e4bc0b09911f585aa", ["legal_request_runbook", "transaction_review", "notice_channels"]],
  ["P21", "India Privacy Supplement", "india-privacy", "REGIONAL_RIGHTS", "ed50a9abba3e1a21d3af1f577c34a08f243736f4af4a83a6b4b4fab5201fbafd", ["india_commencement", "statutory_retention", "grievance_identity", "language_options"]],
  ["P22", "United States State Privacy Notice", "us-privacy", "REGIONAL_RIGHTS", "3bb5747ad45e5ab015e26f5fc3523938fa34b1bae3bfa54f67faa518a14f6b73", ["us_applicability", "us_lookback_inventory", "gpc", "admt_review", "appeals"]],
  ["P23", "EU, EEA and United Kingdom Privacy Supplement", "europe-uk-privacy", "REGIONAL_RIGHTS", "470e60d47f4ee871ca2990c3d2ea3844aa8917ea8fd8c856d6a97d071ce28974", ["eu_uk_applicability", "basis_map", "representatives", "transfers", "uk_changes"]],
  ["P24", "Regional Consumer Rights and Withdrawal Notice", "consumer-rights", "REGIONAL_RIGHTS", "0f547ef4b476847fec8b2768102deba7346e053f51c75896affa59a6812fffda", ["consumer_jurisdictions", "checkout_withdrawal", "refund_workflow", "ecommerce_updates"]],
  ["P25", "Resources and Confidential Document Access Policy", "resources", "COMPANY_AND_TRUST", "d5aa95c919d229f2a7fa0b1a6ef81f3508d8a7f8806d7539d50413c4ebc25df9", ["resource_authorization", "registration_necessity", "pdf_parity", "download_audit"]],
  ["P26", "Policy Changes, Versions and Archive Policy", "policy-versions", "COMPANY_AND_TRUST", "ef442134f0167ef2c8583052b8692d4c4b4d20ca2327050766c9c548a2f6fac1", ["policy_registry", "approvals", "version_archive", "notice_channels"]],
] as const;

export const legalCandidateDocuments: readonly LegalCandidateDocument[] = candidateSeeds.map(([id, title, slug, group, contentSha256, requiredGates]) => ({
  id: id as LegalCandidateDocument["id"],
  title,
  slug,
  route: `/legal/${slug}` as LegalCandidateDocument["route"],
  group: group as LegalDocumentGroup,
  version: "1.0",
  targetEffectiveDate: "2026-11-01",
  updatedAt: "2026-10-06",
  status: "REVIEW_DRAFT",
  publish: false,
  contentSha256,
  approvedContentSha256: null,
  requiredGates,
}));

export function legalCandidateBySlug(slug: string) {
  return legalCandidateDocuments.find((document) => document.slug === slug) ?? null;
}
