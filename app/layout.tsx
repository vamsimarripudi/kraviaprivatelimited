import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Mono, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { BrandSplash } from "@/components/brand-splash";
import { OrganizationJsonLd } from "@/components/structured-data";

const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });
const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"] });

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