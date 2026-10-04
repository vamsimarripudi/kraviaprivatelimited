import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./workspaces.css";
import { isProductionSite, publicSiteIdentity, siteUrl } from "@/lib/site";
import { publicPageRobots } from "@/lib/crawler-policy";
import { BrandSplash } from "@/components/brand-splash";
import { OrganizationJsonLd } from "@/components/structured-data";

const publicDescription = "KRAVIA PRIVATE LIMITED is an Indian software and AI technology company building software products, intelligent systems and digital infrastructure. Official website: kraviaprivatelimited.com.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: publicSiteIdentity.name,
  title: { default: "KRAVIA PRIVATE LIMITED | Software & AI Technology Company", template: `%s — ${publicSiteIdentity.name}` },
  description: publicDescription,
  keywords: ["KRAVIA PRIVATE LIMITED", "Kravia", "software company India", "AI technology company India", "software products", "intelligent systems", "digital infrastructure"],
  creator: publicSiteIdentity.name,
  publisher: publicSiteIdentity.name,
  alternates: { canonical: "/" },
  robots: publicPageRobots(isProductionSite),
  openGraph: {
    type: "website",
    siteName: publicSiteIdentity.name,
    title: "KRAVIA PRIVATE LIMITED | Software & AI Technology Company",
    description: publicDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "KRAVIA PRIVATE LIMITED | Software & AI Technology Company",
    description: publicDescription,
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#183d32" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><body className="kravia-fonts"><OrganizationJsonLd /><BrandSplash />{children}<Analytics /></body></html>;
}
