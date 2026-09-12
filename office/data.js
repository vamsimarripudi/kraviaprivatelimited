window.KRAVIA_SEED = {
  build: {
    version: "1.1.0-executable-enterprise-foundation",
    generatedAt: "2026-09-12",
    mode: "CONTROLLED_LOCAL_FOUNDATION",
    domainTarget: "office.kraviaprivatelimited.com"
  },
  company: {
    id: "KPL-IN-001",
    legalName: "KRAVIA PRIVATE LIMITED",
    cin: "CONTROLLED_NOT_EMBEDDED",
    registeredOffice: "Controlled company master is not embedded in source control.",
    incorporationStatus: "EVIDENCE_REQUIRED",
    country: "India",
    financialYear: "2026-27",
    primaryState: "Andhra Pradesh",
    stateCode: "37",
    officialEmail: "CONTROLLED_NOT_EMBEDDED",
    verification: "PARTIALLY_VERIFIED",
    sources: [
      {label:"Corporate master configuration", status:"REQUIRED_BEFORE_PRODUCTION_LOCK"},
      {label:"Current statutory evidence", status:"ATTACH_IN_PRIVATE_VAULT"}
    ]
  },
  directors: [],
  products: [
    {id:"PROD-VL", code:"VL", name:"VidyaLuma", category:"Education SaaS", status:"ACTIVE_BUILD", legalEntity:"KPL-IN-001", countries:["IN"], commercialOwner:"KRAVIA PRIVATE LIMITED", billingMode:"CENTRAL_ENGINE"},
    {id:"PROD-VM", code:"VM", name:"Vaanmeet", category:"Realtime communications", status:"ACTIVE_BUILD", legalEntity:"KPL-IN-001", countries:["IN"], commercialOwner:"KRAVIA PRIVATE LIMITED", billingMode:"CENTRAL_ENGINE"},
    {id:"PROD-VF", code:"VF", name:"VFormix", category:"Forms & data workflows", status:"ACTIVE_BUILD", legalEntity:"KPL-IN-001", countries:["IN"], commercialOwner:"KRAVIA PRIVATE LIMITED", billingMode:"CENTRAL_ENGINE"}
  ],
  registrations: [
    {id:"REG-CIN", name:"Corporate Identity Number", authority:"MCA", number:"Controlled", status:"EVIDENCE_REQUIRED_IN_OFFICE", evidence:"Attach current authorized evidence", risk:"LOW"},
    {id:"REG-PAN", name:"PAN", authority:"Income Tax", number:"Protected", status:"EVIDENCE_REQUIRED_IN_OFFICE", evidence:"Not embedded in this build", risk:"MEDIUM"},
    {id:"REG-TAN", name:"TAN", authority:"Income Tax", number:"Protected", status:"EVIDENCE_REQUIRED_IN_OFFICE", evidence:"Not embedded in this build", risk:"MEDIUM"},
    {id:"REG-GST", name:"GST Registration", authority:"GST", number:"Not locked", status:"CURRENT_STATUS_REQUIRES_VERIFICATION", evidence:"Attach current registration evidence", risk:"HIGH"},
    {id:"REG-UDYAM", name:"Udyam / MSME", authority:"MSME", number:"Not embedded", status:"REPORTED_COMPLETE_REQUIRES_EVIDENCE_LINK", evidence:"Attach certificate", risk:"MEDIUM"},
    {id:"REG-DPIIT", name:"Startup India / DPIIT", authority:"DPIIT", number:"Not embedded", status:"REPORTED_APPROVED_REQUIRES_EVIDENCE_LINK", evidence:"Attach recognition certificate", risk:"MEDIUM"},
    {id:"REG-EPFO", name:"EPFO", authority:"EPFO", number:"Not embedded", status:"NOT_VERIFIED", evidence:"Applicability/status review required", risk:"MEDIUM"},
    {id:"REG-ESIC", name:"ESIC", authority:"EPFO", number:"Not embedded", status:"NOT_VERIFIED", evidence:"Applicability/status review required", risk:"MEDIUM"}
  ],
  banking: [],
  integrations: [],
  communications: [],
  vendors: [],
  documents: [],
  governance: {meetings: [], authorities: []},
  compliance: [
    {id:"CMP-001", domain:"Company", requirement:"Company master legal identity", owner:"Administration", status:"IN_REVIEW", due:"Before production lock", severity:"HIGH"},
    {id:"CMP-002", domain:"Governance", requirement:"First-year statutory records review", owner:"CS / Director", status:"ACTION_REQUIRED", due:"Priority", severity:"HIGH"},
    {id:"CMP-003", domain:"Tax", requirement:"Confirm current GST registration status and evidence", owner:"CA / Director", status:"ACTION_REQUIRED", due:"Before invoicing", severity:"CRITICAL"},
    {id:"CMP-004", domain:"Banking", requirement:"Attach authorized bank mandate and evidence", owner:"Administration", status:"IN_PROGRESS", due:"Before production lock", severity:"MEDIUM"},
    {id:"CMP-005", domain:"eSign", requirement:"Configure approved eSign provider", owner:"Administration", status:"WAITING_EXTERNAL", due:"Before production lock", severity:"MEDIUM"},
    {id:"CMP-006", domain:"Security", requirement:"Production identity, MFA, RBAC and immutable audit", owner:"Engineering", status:"BUILD_REQUIRED", due:"Before deployment", severity:"CRITICAL"}
  ],
  workflows: [
    {id:"WF-PAY-001", name:"Payment → Invoice → Receipt → Reconciliation", domain:"Finance", trigger:"payment.succeeded", status:"FOUNDATION_READY", automation:"LOCAL_DEMO"},
    {id:"WF-GST-001", name:"Billing → GST Sales Register → Period Review", domain:"Tax", trigger:"invoice.issued", status:"FOUNDATION_READY", automation:"LOCAL_DEMO"},
    {id:"WF-GOV-001", name:"Meeting → Resolution → CTC → Authority", domain:"Governance", trigger:"meeting.approved", status:"CONTROL_MODEL_READY", automation:"HUMAN_APPROVAL"},
    {id:"WF-VEN-001", name:"Vendor Invoice → Classification → Approval → Ledger", domain:"Procurement", trigger:"vendor.invoice.received", status:"DESIGNED", automation:"SOURCE_ADAPTER_REQUIRED"},
    {id:"WF-INS-001", name:"Inspection Request → Controlled Evidence Manifest", domain:"Audit", trigger:"inspection.created", status:"IMPLEMENTED_LOCAL", automation:"LOCAL"}
  ],
  roles: [
    {role:"Owner / Founder", company:"FULL", finance:"FULL", governance:"FULL", people:"FULL", audit:"FULL"},
    {role:"Director", company:"READ", finance:"APPROVAL", governance:"FULL", people:"LIMITED", audit:"READ"},
    {role:"Finance", company:"LIMITED", finance:"FULL", governance:"NONE", people:"PAYROLL_ONLY", audit:"READ"},
    {role:"CA", company:"LIMITED", finance:"TAX_ACCOUNTING", governance:"NONE", people:"NONE", audit:"READ"},
    {role:"CS", company:"CORPORATE", finance:"NONE", governance:"FULL", people:"NONE", audit:"READ"},
    {role:"Auditor", company:"READ", finance:"READ", governance:"READ", people:"NONE", audit:"READ_ONLY"},
    {role:"Product Admin", company:"NONE", finance:"PRODUCT_SCOPE", governance:"NONE", people:"NONE", audit:"PRODUCT_SCOPE"}
  ]
};