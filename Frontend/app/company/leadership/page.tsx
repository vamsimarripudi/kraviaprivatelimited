import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { BreadcrumbJsonLd } from "@/components/structured-data";
import { LeadershipContent } from "@/components/leadership/leadership-content";
import { publicPageRobots } from "@/lib/crawler-policy";
import { isProductionSite, siteUrl } from "@/lib/site";
import { leadershipDescription, leadershipJsonLd, leadershipPath, leadershipTitle, serializeLeadershipJsonLd } from "@/lib/leadership";

export const metadata: Metadata = {
  title: leadershipTitle,
  description: leadershipDescription,
  alternates: { canonical: leadershipPath },
  robots: publicPageRobots(isProductionSite),
  openGraph: { title: `${leadershipTitle} | KRAVIA PRIVATE LIMITED`, description: leadershipDescription, url: `${siteUrl}${leadershipPath}`, type: "website" },
  twitter: { card: "summary_large_image", title: `${leadershipTitle} | KRAVIA PRIVATE LIMITED`, description: leadershipDescription },
};

export default function LeadershipPage() {
  return <>
    <SiteNav />
    <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Company", path: "/company" }, { name: leadershipTitle, path: leadershipPath }]} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeLeadershipJsonLd(leadershipJsonLd(siteUrl)) }} />
    <main id="main-content"><LeadershipContent /></main>
    <Footer />
  </>;
}
