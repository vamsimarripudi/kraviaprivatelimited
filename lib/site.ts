import { resolvePublicSiteUrl } from "./env/public";

export const siteUrl = resolvePublicSiteUrl();

// Deliberately incomplete until verified corporate records are supplied.
export const companyProfile = {
  legalName: "KRAVIA PRIVATE LIMITED",
  displayName: "Kravia",
  companyType: "Private Limited Company",
  country: "India",
  incorporationDate: null as string | null,
  cin: null as string | null,
  registeredOffice: null as string | null,
  corporateEmail: null as string | null,
  website: null as string | null,
  gst: { registered: null as boolean | null, gstin: null as string | null },
} as const;

export const navItems = [
  ["Company", "/company"], ["Products", "/products"], ["Technology", "/technology"],
  ["Governance", "/governance"], ["Trust", "/trust"], ["Careers", "/careers"],
] as const;

export const publicPages: Record<string, { eyebrow: string; title: string; intro: string; sections: { title: string; body: string }[] }> = {
  company: { eyebrow: "Company", title: "A company built for durable work.", intro: "Kravia is establishing a long-term technology company with a calm, exacting approach to software, intelligent systems and digital infrastructure.", sections: [
    { title: "Purpose", body: "To make complex work simpler, safer and more connected through useful technology." },
    { title: "How we work", body: "We value clarity, engineering judgement, responsible use of technology and long-term trust." },
    { title: "Corporate information", body: "Verified statutory particulars will be published here only after corporate approval. Kravia does not publish unverified registration details." },
  ] },
  products: { eyebrow: "Products", title: "Useful technology, made with care.", intro: "Kravia develops products and systems for real-world work. Only approved public products are shown here.", sections: [
    { title: "VidyaLuma", body: "An education-focused product identity within the Kravia portfolio. Product positioning, assets and external links will be published only when formally approved." },
    { title: "Portfolio discipline", body: "A corporate portfolio should describe what is ready to be public—not a confidential product roadmap." },
  ] },
  technology: { eyebrow: "Technology", title: "Engineering that earns confidence.", intro: "Our direction spans software products, intelligent systems and digital infrastructure designed to be legible, resilient and responsibly operated.", sections: [
    { title: "Systems thinking", body: "We design across interfaces, data, operations and governance—not isolated screens." },
    { title: "Responsible delivery", body: "Technology decisions are shaped by security, privacy, accessibility and the people who depend on them." },
  ] },
  governance: { eyebrow: "Governance", title: "Accountability is part of the work.", intro: "Kravia’s governance approach is designed to support thoughtful oversight, clear records and responsible corporate decision-making.", sections: [
    { title: "Public governance", body: "This page explains our approach. Private board notices, agendas, minutes, voting records and attachments are never published here." },
    { title: "Corporate Office", body: "Authorised directors and professionals use a separate, access-controlled Corporate Office for sensitive records and workflows." },
  ] },
  disclosures: { eyebrow: "Corporate disclosures", title: "A permanent home for approved public records.", intro: "This register will organise formally approved statutory public notices, annual returns and public policies by financial year.", sections: [
    { title: "Publication controls", body: "A disclosure must pass private review and approval before publication. Publishing one document never exposes a private document vault." },
    { title: "No documents published", body: "There are currently no verified public disclosure documents configured for publication." },
  ] },
  updates: { eyebrow: "Updates", title: "Official company updates.", intro: "Kravia will publish approved announcements, public notices and company milestones here.", sections: [{ title: "No updates published", body: "There are no approved updates to publish at this time." }] },
  careers: { eyebrow: "Careers", title: "Build carefully. Think long-term.", intro: "We are building a company for people who care about useful, responsible technology and precise execution.", sections: [{ title: "Open roles", body: "There are no approved open roles at this time. Future opportunities will be published here." }, { title: "Internships", body: "Internship opportunities will be listed only when an approved role is open." }] },
  contact: { eyebrow: "Contact", title: "Start a considered conversation.", intro: "Choose the enquiry that best fits your reason for contacting Kravia. We use your details only to respond to this request.", sections: [{ title: "Corporate contact", body: "Verified corporate contact details will be published once approved. In the meantime, use the enquiry form below." }] },
  legal: { eyebrow: "Legal", title: "Clear terms. Clear responsibilities.", intro: "Legal notices and policies are published here when reviewed and approved for use.", sections: [{ title: "Policies", body: "Privacy, data protection, security and responsible AI information are available through the Trust Center." }] },
  trust: { eyebrow: "Trust Center", title: "Trust should be designed in.", intro: "Kravia’s public Trust Center explains our approach to privacy, data protection, security, responsible AI and accessibility.", sections: [{ title: "Practical, not performative", body: "We do not make claims about certifications, approvals or compliance status without a verified basis." }] },
  "trust/privacy": { eyebrow: "Trust / Privacy", title: "Privacy with purpose.", intro: "This notice explains how Kravia handles information collected through its website and approved services.", sections: [{ title: "Contextual notice", body: "Forms explain why information is collected at the point it is requested. Optional marketing consent is not bundled into essential enquiries." }, { title: "Contact", body: "A verified privacy contact will be added before production launch." }] },
  "trust/data-protection": { eyebrow: "Trust / Data protection", title: "Your information, handled with care.", intro: "Kravia collects only the details needed to respond to enquiries, process privacy requests, operate authorised services and meet applicable obligations. Retention periods and processing details require legal review before launch.", sections: [{ title: "Your choices", body: "You can submit a privacy question, access, correction, erasure, consent-related request, grievance or security concern through our private request flow." }, { title: "Official Government resources", body: "Before production launch, Kravia will link the current official Digital Personal Data Protection Act, Rules, commencement material and corrigenda from India Code, MeitY and eGazette after legal verification." }] },
  "trust/security": { eyebrow: "Trust / Security", title: "Security is operational.", intro: "We build access controls, secure processing patterns and appropriate review into the way company systems are operated.", sections: [{ title: "Responsible reporting", body: "A verified security reporting channel will be published before launch. Do not send sensitive data through unverified channels." }] },
  "trust/responsible-ai": { eyebrow: "Trust / Responsible AI", title: "Intelligence with judgement.", intro: "Where intelligent systems are used, Kravia aims to make their purpose, limitations and human oversight clear.", sections: [{ title: "Human accountability", body: "Automated tools should support responsible decisions, not obscure who is accountable for them." }] },
};

export const officialLinks = [
  { label: "Digital Personal Data Protection Act, 2023 — India Code", href: "https://www.indiacode.nic.in/handle/123456789/22037" },
  { label: "Digital Personal Data Protection Rules, 2025 — MeitY", href: "https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa" },
  { label: "Official Gazette: DPDP Rules, 2025", href: "https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf" },
];
