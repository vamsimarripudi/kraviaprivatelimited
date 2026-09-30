import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./workspaces.css";
import { isProductionSite, publicSiteIdentity, siteUrl } from "@/lib/site";
import { publicPageRobots } from "@/lib/crawler-policy";
import { BrandSplash } from "@/components/brand-splash";
import { OrganizationJsonLd } from "@/components/structured-data";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: publicSiteIdentity.name,
  title: { default: publicSiteIdentity.name, template: `%s — ${publicSiteIdentity.name}` },
  description: "Kravia builds software products, intelligent systems and digital infrastructure.",
  alternates: { canonical: "/" },
  robots: publicPageRobots(isProductionSite),
  openGraph: {
    type: "website",
    siteName: publicSiteIdentity.name,
    title: publicSiteIdentity.name,
    description: "Building technology for what comes next.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: publicSiteIdentity.name,
    description: "Building technology for what comes next.",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#183d32" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><body className="kravia-fonts"><OrganizationJsonLd /><BrandSplash />{children}<Analytics /></body></html>;
}
