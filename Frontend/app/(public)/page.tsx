import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TechnologyHero } from "@/components/technology-hero";
import { DiwaliCelebration } from "@/components/diwali-celebration";
import { MagneticLink } from "@/components/premium-interactions";
import { HomepageBody } from "@/components/homepage-body";
import { getPublicCompanyProfile } from "@/lib/corporate/public-facts";
import { getPublishedNewsroomContent } from "@/lib/content/repository";
import { getPublicPortfolio } from "@/lib/content/portfolio";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [newsroom, profile, products] = await Promise.all([getPublishedNewsroomContent(), getPublicCompanyProfile(), getPublicPortfolio()]);
  return (
    <>
      <DiwaliCelebration brand="kravia" />
      <main id="main-content">
        <TechnologyHero />
        <HomepageBody profile={profile} products={products} newsroom={newsroom} />

        <section className="signature-prefooter">
          <div className="shell signature-prefooter-inner">
            <div className="signature-line" aria-hidden="true"><i /><i /></div>
            <div className="signature-prefooter-copy">
              <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
              <h2>Ideas become systems.<br /><em>Systems become products.</em></h2>
              <p>Explore the work, or start a conversation.</p>
            </div>
            <div className="signature-prefooter-actions"><MagneticLink className="button button-light premium-cta" href="/products">Explore our products <ArrowUpRight /></MagneticLink><Link className="text-link inverse-link" href="/contact">Talk to Kravia</Link></div>
          </div>
        </section>
      </main>

    </>
  );
}
