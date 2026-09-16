import { siteUrl } from "@/lib/site";
import { getPublicCompanyProfile } from "@/lib/corporate/public-facts";
import { publicProducts } from "@/lib/corporate-content";

type Breadcrumb = { name: string; path: string };

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export async function OrganizationJsonLd() {
  const companyProfile = await getPublicCompanyProfile();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Corporation",
    "@id": `${siteUrl}#organization`,
    name: companyProfile.displayName,
    legalName: companyProfile.legalName,
    url: siteUrl,
    logo: `${siteUrl}/brand/kravia-logo.png`,
    areaServed: companyProfile.country,
    ...(companyProfile.incorporationDate ? { foundingDate: companyProfile.incorporationDate } : {}),
    ...(companyProfile.registeredOffice ? { address: companyProfile.registeredOffice } : {}),
    ...(companyProfile.corporateEmail ? { email: companyProfile.corporateEmail } : {}),
  };
  const website = { "@context": "https://schema.org", "@type": "WebSite", name: companyProfile.legalName, url: siteUrl };
  return <><JsonLd data={organization} /><JsonLd data={website} /></>;
}

export function BreadcrumbJsonLd({ items }: { items: Breadcrumb[] }) {
  if (items.length < 2) return null;
  return <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${siteUrl}${item.path}` })) }} />;
}

export function ProductJsonLd({ slug }: { slug: string }) {
  const product = publicProducts.find((candidate) => candidate.slug === slug && candidate.public);
  if (!product) return null;
  return <JsonLd data={{ "@context": "https://schema.org", "@type": "SoftwareApplication", name: product.name, applicationCategory: product.category, description: product.description, ...(product.href ? { url: `${siteUrl}${product.href}` } : {}), publisher: { "@id": `${siteUrl}#organization` } }} />;
}
export function WebPageJsonLd({ name, description, path, about }: { name: string; description: string; path: string; about?: string }) {
  return <JsonLd data={{
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: `${siteUrl}${path}`,
    ...(about ? { about } : {}),
    publisher: { "@id": `${siteUrl}#organization` },
  }} />;
}
