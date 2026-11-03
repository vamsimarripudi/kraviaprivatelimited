import { companyNarrative, publicCompanyInformation, publicProducts, type KraviaProduct } from "./corporate-content";
import { isPublicSitemapPath } from "./crawler-policy";
import { publicSocialProfiles } from "./public-links";
import { isProductionSite, siteUrl } from "./site";

export const companyFaqPath = "/company/faq";
export const companyFaqDescription = "Answers about KRAVIA PRIVATE LIMITED, its public product portfolio, company identity, official channels and contact information.";

const statusLabels: Record<KraviaProduct["status"], string> = {
  ACTIVE: "Active", BETA: "Beta", COMING_SOON: "In development / coming soon", PRIVATE: "Private",
  ACQUIRED: "Acquired", DISCONTINUED: "Discontinued", ARCHIVED: "Archived",
};

/** Explicit public-field projection, not a database dump or a serialization of internal records. */
export function discoveryProducts(products: readonly KraviaProduct[] = publicProducts) {
  return products.filter((product) => product.public && product.status !== "PRIVATE" && product.href && isPublicSitemapPath(product.href)).map((product) => ({
    name: product.name, description: product.description, category: product.category,
    status: statusLabels[product.status], href: product.href as string,
  }));
}

export function companyFaqs() {
  const products = discoveryProducts();
  return [
    { id: "what-is-kravia", question: "What is KRAVIA?", answer: companyNarrative.summary, source: "/company/about", sourceLabel: "About KRAVIA" },
    { id: "company-identity", question: "What is KRAVIA's legal name and where is it based?", answer: `The legal name is ${publicCompanyInformation.legalName.value}. It is an Indian private limited company. Its approved registered-office address is ${publicCompanyInformation.registeredOffice.value}.`, source: "/company/corporate-information", sourceLabel: "Corporate information" },
    { id: "products", question: "Which products are in KRAVIA's public portfolio?", answer: products.length ? `The public portfolio includes ${products.map((product) => product.name).join(", ")}. Each product has its own purpose and availability status. A product described as in development or coming soon is not a claim of general availability.` : "Current product information is available on the public portfolio page.", source: "/products", sourceLabel: "Product portfolio" },
    { id: "availability", question: "How can I check whether a product is available?", answer: "Read the current product page and contact KRAVIA about access. Public product information does not by itself confirm a launch date, price, service commitment or access entitlement.", source: "/contact", sourceLabel: "Contact KRAVIA" },
    { id: "contact", question: "How do I contact KRAVIA?", answer: `Use the Contact page for business, product, partnership or corporate enquiries. The published corporate email is ${publicCompanyInformation.email.value}. Security concerns should use the dedicated security-reporting route, not a public social comment.`, source: "/contact", sourceLabel: "Contact and enquiry routes" },
    { id: "official-channels", question: "Where are KRAVIA's official social profiles?", answer: "KRAVIA's corporate channels are on Facebook, Instagram, X and LinkedIn. The direct links on this page and in the website footer identify those corporate profiles; they are not separate product accounts.", source: "/contact", sourceLabel: "Official company channels" },
    { id: "policies", question: "Where can I find privacy, security and legal information?", answer: "The Trust Center and Legal section publish KRAVIA's public policies. Product-specific terms and availability should be checked on the relevant product page. Internal systems and private records are not public documentation.", source: "/trust", sourceLabel: "Trust Center" },
  ];
}

const absolute = (path: string) => new URL(path, siteUrl).toString();
const link = (label: string, path: string) => `[${label}](${absolute(path)})`;

export function companyFaqMarkdown(): string {
  const answers = companyFaqs().map((item) => `## ${item.question}\n\n${item.answer}\n\nSource: ${link(item.sourceLabel, item.source)}`).join("\n\n");
  const products = discoveryProducts().map((product) => `### ${product.name}\n\n${product.description}\n\nCategory: ${product.category}. Public status: ${product.status}.\n\n${link("Product information", product.href)}`).join("\n\n");
  const profiles = publicSocialProfiles.map((profile) => `- [${profile.label}](${profile.href})`).join("\n");
  return `# KRAVIA — Company questions and answers\n\n${companyFaqDescription}\n\nCanonical page: ${absolute(companyFaqPath)}\n\n${answers}\n\n## Public product information\n\n${products}\n\n## Official corporate social channels\n\n${profiles}\n`;
}

export function llmsIndex(): string {
  return `# KRAVIA PRIVATE LIMITED\n\n> ${companyNarrative.summary}\n\nOfficial website: ${absolute("/")}\n\nThis is a public reading guide. It does not grant access to private records, authorize transactions, or imply that a product is generally available. Refer to the linked public pages for current details.\n\n## Company and products\n\n- ${link("Company questions and answers (Markdown)", "/company/faq.md")}: company identity, public products, status and contact routes.\n- ${link("About KRAVIA", "/company/about")}\n- ${link("Corporate information", "/company/corporate-information")}\n- ${link("Public product portfolio", "/products")}\n${discoveryProducts().map((product) => `- ${link(product.name, product.href)}: ${product.category}; ${product.status}.`).join("\n")}\n\n## Official sources\n\n- ${link("Newsroom", "/newsroom")}\n- ${link("Trust Center", "/trust")}\n- ${link("Legal policies", "/legal")}\n- ${link("Contact", "/contact")}\n- ${link("Sitemap", "/sitemap.xml")}\n\n## Optional\n\n- ${link("Expanded public overview", "/llms-full.txt")}: the same public FAQ and product information in one text document.\n`;
}

export function discoveryTextResponse(body: string, canonicalPath: string, markdown = false, production = isProductionSite): Response {
  return new Response(body, { headers: {
    "Content-Type": `${markdown ? "text/markdown" : "text/plain"}; charset=utf-8`,
    "Cache-Control": production ? "public, max-age=300, s-maxage=3600" : "no-store",
    "X-Content-Type-Options": "nosniff",
    Link: `<${absolute(canonicalPath)}>; rel="canonical", <${absolute("/llms.txt")}>; rel="describedby"`,
    ...(!production ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
  } });
}
