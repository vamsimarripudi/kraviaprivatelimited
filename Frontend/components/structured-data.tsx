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
    sameAs: Object.values(publicCompanyLinks),
    description: "KRAVIA PRIVATE LIMITED is an India-incorporated technology startup developing proprietary software platforms, including its flagship education product VidyaLuma. The company focuses on product ownership, software development and platform operation.",
    url: siteUrl,
    logo: `${siteUrl}/brand/kravia-logo.png`,
    areaServed: corporateIdentity.country,
    knowsAbout: ["Proprietary software products", "School operations software", "Recruitment software", "SaaS product engineering"],
    owns: publicProducts.flatMap((product) => product.public && product.href?.startsWith("/") ? [{ "@id": `${siteUrl}${product.href}#product` }] : []),
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
  const unreleased = product.status === "COMING_SOON";
  return <JsonLd data={{
    "@context": "https://schema.org",
    "@type": unreleased ? "CreativeWork" : "SoftwareApplication",
    "@id": `${siteUrl}${product.href ?? "/products"}#product`,
    name: product.name,
    description: product.description,
    ...(unreleased ? { creativeWorkStatus: "In development" } : { applicationCategory: product.category }),
    ...(product.href ? { url: `${siteUrl}${product.href}` } : {}),
    ...(product.website?.startsWith("https://") ? { sameAs: product.website } : {}),
    creator: { "@id": `${siteUrl}#organization` },
    publisher: { "@id": `${siteUrl}#organization` },
  }} />;
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
