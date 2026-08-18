import { publicCompanyInformation } from "./corporate-content";
import { resolvePublicSiteUrl } from "./env/public";

export const siteUrl = resolvePublicSiteUrl();
export const isProductionSite = /^https:\/\//.test(siteUrl) && !/localhost|127\.0\.0\.1/.test(siteUrl);

export const companyProfile = {
  legalName: publicCompanyInformation.legalName.value,
  displayName: publicCompanyInformation.displayName.value,
  companyType: publicCompanyInformation.entityType.value,
  country: publicCompanyInformation.country.value,
  incorporationDate: publicCompanyInformation.incorporationDate.value,
  cin: publicCompanyInformation.cin.value,
  registeredOffice: publicCompanyInformation.registeredOffice.value,
  corporateEmail: publicCompanyInformation.email.value,
  website: isProductionSite ? siteUrl : null,
  gst: {
    registered: publicCompanyInformation.gstRegistered.value,
    gstin: publicCompanyInformation.gstin.value,
  },
} as const;

export const navItems = [
  ["Company", "/company"],
  ["Products", "/products"],
  ["Technology", "/technology"],
  ["Governance", "/governance"],
  ["Trust", "/trust"],
  ["Newsroom", "/newsroom"],
  ["Careers", "/careers"],
] as const;

export type PublicPage = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
  updatedAt?: string;
};

export const publicPages: Record<string, PublicPage> = {
  company: { eyebrow: "Company", title: "A company built for durable work.", intro: "Kravia is establishing a long-term technology company with a calm, exacting approach to software, intelligent systems and digital infrastructure.", sections: [
    { title: "Purpose", body: "To make complex work simpler, safer and more connected through useful technology." },
    { title: "How we work", body: "We value clarity, engineering judgement, responsible use of technology and long-term trust." },
    { title: "Corporate information", body: "Verified statutory particulars are published only after corporate approval. Kravia does not publish unverified registration details." },
  ] },
  "company/about": { eyebrow: "Company / About", title: "Useful technology, carefully built.", intro: "Kravia Private Limited is an Indian technology company building software products, intelligent systems and digital infrastructure for organisations that need simpler, safer and more connected ways to work.", sections: [
    { title: "What Kravia does", body: "We create product and infrastructure foundations that reduce avoidable complexity while keeping accountability visible." },
    { title: "A company, not a single product", body: "Kravia is designed to steward an evolving portfolio of serious technology products over time." },
  ] },
  "company/principles": { eyebrow: "Company / Principles", title: "A durable way of working.", intro: "Our principles help keep product ambition, engineering judgement and responsibility in the same conversation.", sections: [
    { title: "Build for usefulness", body: "Start with the work people need to do, not a feature list." },
    { title: "Earn trust", body: "Treat privacy, security and accountability as part of the product." },
  ] },
  "company/corporate-information": { eyebrow: "Company / Corporate information", title: "Corporate identity, stated clearly.", intro: "Public company facts are shown only when verified and approved for publication. Sensitive identifiers and personal information remain private.", sections: [
    { title: "Publication governance", body: "Corporate details are drawn from one governed record so the website, disclosures, emails and structured data do not conflict." },
  ] },
  products: { eyebrow: "Products", title: "Useful technology, made with care.", intro: "Kravia develops products and systems for real-world work. Only approved public products are shown here.", sections: [
    { title: "VidyaLuma", body: "An education-focused product identity within the Kravia portfolio." },
    { title: "Portfolio discipline", body: "A corporate portfolio describes what is ready to be public—not a confidential roadmap." },
  ] },
  technology: { eyebrow: "Technology", title: "Engineering that earns confidence.", intro: "Our direction spans software products, intelligent systems and digital infrastructure designed to be legible, resilient and responsibly operated.", sections: [
    { title: "Systems thinking", body: "We design across interfaces, data, operations and governance—not isolated screens." },
    { title: "Responsible delivery", body: "Technology decisions are shaped by security, privacy, accessibility and the people who depend on them." },
  ] },
  "technology/engineering": { eyebrow: "Technology / Engineering", title: "Engineering from the experience down.", intro: "Kravia approaches technology as a connected system: experience, application logic, services, data and infrastructure.", sections: [
    { title: "Product engineering", body: "We connect customer context, product decisions and implementation quality." },
    { title: "Systems engineering", body: "We make the relationships between services, data and operations legible." },
  ] },
  "technology/ai": { eyebrow: "Technology / Applied AI", title: "Intelligence with judgement.", intro: "AI is one engineering capability within Kravia—not a substitute for accountable product and operational decisions.", sections: [
    { title: "Appropriate automation", body: "We use automation where it can reduce repetitive work while keeping human oversight meaningful." },
    { title: "Responsible practice", body: "Purpose, limitations, privacy-aware data use, evaluation and safe failure modes deserve explicit attention." },
  ] },
  newsroom: { eyebrow: "Newsroom", title: "Official company updates.", intro: "Company, product, engineering, research and press material is published through Kravia’s reviewed public-content workflow.", sections: [{ title: "Publication governance", body: "Only approved public records appear in the Newsroom. Drafts, review comments and supporting evidence remain private." }] },
  "newsroom/media-kit": { eyebrow: "Newsroom / Media kit", title: "Official Kravia media resources.", intro: "A concise, approved reference for journalists, partners and other authorised public uses of the Kravia identity.", sections: [{ title: "Use the approved identity", body: "Kravia does not authorise recreated or modified versions of its logo or corporate identity." }] },
  "trust/accessibility": { eyebrow: "Trust / Accessibility", title: "Accessibility is maintained work.", intro: "Kravia aims for an accessible, readable public experience and treats feedback as part of continuous improvement.", sections: [{ title: "Accessibility feedback", body: "A verified accessibility contact will be published before production launch. We do not claim perfect accessibility." }] },
  "trust/security-reporting": { eyebrow: "Trust / Security reporting", title: "Report a security concern responsibly.", intro: "Use the approved security reporting channel once it is published. Do not send passwords, private keys, personal identity records or confidential data in an initial report.", sections: [{ title: "What to include", body: "Describe the affected Kravia service, the observed behaviour and a safe way to reproduce the issue. Kravia does not currently operate a public bug-bounty programme." }] },  governance: { eyebrow: "Governance", title: "Accountability is part of the work.", intro: "Kravia’s governance approach is designed to support thoughtful oversight, clear records and responsible corporate decision-making.", sections: [
    { title: "Public governance", body: "This page explains our approach. Private board notices, agendas, minutes, voting records and attachments are never published here." },
    { title: "Corporate Office", body: "Authorised directors and professionals use a separate, access-controlled Corporate Office for sensitive records and workflows." },
  ] },
  disclosures: { eyebrow: "Corporate disclosures", title: "A permanent home for approved public records.", intro: "This register will organise formally approved statutory public notices, annual returns and public policies by financial year.", sections: [
    { title: "Publication controls", body: "A disclosure must pass private review and approval before publication. Publishing one document never exposes a private document vault." },
    { title: "No documents published", body: "There are currently no verified public disclosure documents configured for publication." },
  ] },
  updates: { eyebrow: "Newsroom", title: "Official company updates.", intro: "Kravia will publish approved announcements, public notices and company milestones here.", sections: [{ title: "No updates published", body: "There are no approved updates to publish at this time." }] },
  careers: { eyebrow: "Careers", title: "Build carefully. Think long-term.", intro: "We are building a company for people who care about useful, responsible technology and precise execution.", sections: [{ title: "Open roles", body: "There are no approved open roles at this time. Future opportunities will be published here." }, { title: "How we work", body: "Kravia values clear responsibility, thoughtful engineering and work that holds up over time." }] },
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
