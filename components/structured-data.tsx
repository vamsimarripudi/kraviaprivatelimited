import { companyProfile, siteUrl } from "@/lib/site";

export function OrganizationJsonLd() {
  const data = { "@context": "https://schema.org", "@type": "Corporation", name: companyProfile.displayName, legalName: companyProfile.legalName, url: siteUrl, logo: `${siteUrl}/brand/kravia-logo.png`, areaServed: companyProfile.country };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
