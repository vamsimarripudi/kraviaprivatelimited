import { publicWebsiteStructuredData, siteUrl } from "@/lib/site";
import { corporateIdentity, publicProducts } from "@/lib/corporate-content";
import { leadershipRelationships } from "@/lib/leadership";

import { publicCompanyLinks } from "@/lib/public-links";

type Breadcrumb = { name: string; path: string };

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export async function OrganizationJsonLd() {
  const identifiers = [
    { "@type": "PropertyValue", propertyID: "CIN", value: corporateIdentity.cin },
    { "@type": "PropertyValue", propertyID: "GSTIN", value: corporateIdentity.gstin },
  ].filter(Boolean);
  const organization = {
    "@context": "https://schema.org",
    "@type": "Corporation",
    "@id": `${siteUrl}#organization`,
    name: corporateIdentity.legalName,
    alternateName: corporateIdentity.displayName,
    legalName: corporateIdentity.legalName,
    sameAs: [publicCompanyLinks.linkedIn],
    description: "KRAVIA PRIVATE LIMITED is an Indian technology company building software products, intelligent systems and digital infrastructure.",
    url: siteUrl,
    logo: `${siteUrl}/brand/kravia-logo.png`,
    areaServed: corporateIdentity.country,
    foundingDate: corporateIdentity.incorporationDate,
    ...leadershipRelationships(siteUrl),
    address: {
      "@type": "PostalAddress",
      streetAddress: corporateIdentity.registeredOffice.line1,
      addressLocality: corporateIdentity.registeredOffice.locality,
      addressRegion: corporateIdentity.registeredOffice.state,
      postalCode: corporateIdentity.registeredOffice.postalCode,
      addressCountry: "IN",
    },
    ...(corporateIdentity.contact.email ? {
      email: corporateIdentity.contact.email,
      contactPoint: {
        "@type": "ContactPoint",
        email: corporateIdentity.contact.email,
        telephone: corporateIdentity.contact.telephone,
        contactType: "corporate enquiries",
        availableLanguage: ["en"],
      },
    } : {}),
    taxID: corporateIdentity.gstin,
    ...(identifiers.length ? { identifier: identifiers } : {}),
  };
  const website = publicWebsiteStructuredData();
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
