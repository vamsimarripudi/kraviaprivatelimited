import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspaces.css";
import "./public-typography.css";
import "./public-refinements.css";
import { isProductionSite, publicSiteIdentity, siteUrl } from "@/lib/site";
import { publicPageRobots } from "@/lib/crawler-policy";
import { BrandSplash } from "@/components/brand-splash";
import { CookiePreferences } from "@/components/cookie-preferences";
import { OptionalAnalytics } from "@/components/optional-analytics";
import { OrganizationJsonLd } from "@/components/structured-data";

const publicDescription = "KRAVIA PRIVATE LIMITED is an Indian technology company building software products, intelligent systems and digital infrastructure for organisations.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: publicSiteIdentity.name,
  title: { default: "KRAVIA PRIVATE LIMITED | Software & AI Technology Company", template: `%s — ${publicSiteIdentity.name}` },
  description: publicDescription,
  creator: publicSiteIdentity.name,
  publisher: publicSiteIdentity.name,
  robots: publicPageRobots(isProductionSite),
  openGraph: {
    type: "website", siteName: publicSiteIdentity.name,
    title: "KRAVIA PRIVATE LIMITED | Software & AI Technology Company",
    description: publicDescription, url: "/",
  },
  twitter: {
    card: "summary_large_image", site: "@KraviaOfficial",
    title: "KRAVIA PRIVATE LIMITED | Software & AI Technology Company",
    description: publicDescription,
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#071e45" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><head><link rel="describedby" href="/llms.txt" type="text/plain" /></head><body className="kravia-fonts"><OrganizationJsonLd /><BrandSplash />{children}<CookiePreferences /><OptionalAnalytics /></body></html>;
}
