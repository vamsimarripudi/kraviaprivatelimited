import type { Metadata } from "next";
import { DM_Serif_Display, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { BrandSplash } from "@/components/brand-splash";
import { OrganizationJsonLd } from "@/components/structured-data";

const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });
const serif = DM_Serif_Display({ variable: "--font-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Kravia Private Limited", template: "%s — Kravia" },
  description: "Kravia builds software products, intelligent systems and digital infrastructure.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Kravia Private Limited",
    title: "Kravia Private Limited",
    description: "Building technology for what comes next.",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${sans.variable} ${mono.variable} ${serif.variable}`}><OrganizationJsonLd /><BrandSplash />{children}<Analytics /></body></html>;
}