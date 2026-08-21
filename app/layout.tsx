import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { BrandSplash } from "@/components/brand-splash";
import { OrganizationJsonLd } from "@/components/structured-data";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400" });

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