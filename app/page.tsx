import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Building2, Fingerprint, Network, ShieldCheck, Waypoints } from "lucide-react";
import { Footer } from "@/components/footer";
import { KLine } from "@/components/k-line";
import { SiteNav } from "@/components/site-nav";
import { HeroMotion, Reveal } from "@/components/motion";
import { CapabilityExplorer, MagneticLink } from "@/components/premium-interactions";
import { companyNarrative, publicCompanyInformation, publicProducts } from "@/lib/corporate-content";

const operatingAreas = [
  ["Company", "A long-lived corporate foundation for products, people and partners.", "/company/about"],
  ["Technology", "Engineering decisions that prioritise usefulness, reliability and restraint.", "/technology/engineering"],
  ["Governance", "Clear records, thoughtful controls and accountable ways of working.", "/governance"],
] as const;

const buildApproach = ["Understand", "Design", "Engineer", "Protect", "Learn", "Improve"];
const atAGlance = [
  ["Identity", publicCompanyInformation.legalName.value],
  ["Base", publicCompanyInformation.country.value],
  ["Focus", "Software products · Intelligent systems · Digital infrastructure"],
  ["Flagship product", publicProducts[0]?.name ?? null],
].filter(([, value]) => Boolean(value)) as [string, string][];

const publicFactRows = [
  ["Legal name", publicCompanyInformation.legalName.value],
  ["Entity type", publicCompanyInformation.entityType.value],
  ["Country", publicCompanyInformation.country.value],
  ["CIN", publicCompanyInformation.cin.value],
  ["Registered office", publicCompanyInformation.registeredOffice.value],
  ["Email", publicCompanyInformation.email.value],
  ["Telephone", publicCompanyInformation.telephone.value],
].filter(([, value]) => Boolean(value)) as [string, string][];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="main-content">
        <section className="hero shell">
          <div className="hero-meta"><span>INDIA</span><span>SOFTWARE</span><span>AI</span><span>INFRASTRUCTURE</span></div>
          <HeroMotion />
          <div className="hero-foot">
            <p>Kravia builds software products, intelligent systems and digital infrastructure designed to make complex work simpler, safer and more connected.</p>
            <div><MagneticLink className="button button-light premium-cta" href="/products">Explore our products <ArrowUpRight /></MagneticLink><Link className="text-link" href="/company/about">About Kravia</Link></div>
          </div>
          <KLine className="hero-line" />
        </section>

        <section className="at-a-glance shell" aria-labelledby="glance-title">
          <div><p className="eyebrow">01 / AT A GLANCE</p><h2 id="glance-title">A corporate identity<br />with room to grow.</h2></div>
          <dl>{atAGlance.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>

        <section className="intro shell grid-12">
          <Reveal className="intro-kicker span-3"><p className="eyebrow">02 / WHO WE ARE</p></Reveal>
          <Reveal className="span-8"><h2>{companyNarrative.summary.split(" for ")[0]} <em>for work that matters.</em></h2><p>{companyNarrative.summary}</p><Link href="/company/about" className="text-link">Meet Kravia <ArrowDownRight /></Link></Reveal>
        </section>

        <section className="dark-section">
          <div className="shell">
            <div className="section-head"><p className="eyebrow">03 / WHAT WE BUILD</p><h2>Systems with a<br /><em>useful point of view.</em></h2></div>
            <div className="build-grid">
              <article><Building2 /><h3>Software products</h3><p>Clear, focused products that help people work with more confidence.</p></article>
              <article><Fingerprint /><h3>Intelligent systems</h3><p>Practical intelligence designed with human judgement in view.</p></article>
              <article><Waypoints /><h3>Digital infrastructure</h3><p>Connected foundations for work that needs to remain reliable.</p></article>
            </div>
          </div>
        </section>

        <section className="purpose-band shell">
          <p className="eyebrow">04 / WHY KRAVIA EXISTS</p>
          <div><h2>{companyNarrative.purpose}</h2><p><b>Mission.</b> {companyNarrative.mission}</p><p><b>Vision.</b> {companyNarrative.vision}</p></div>
        </section>

        <CapabilityExplorer />

        <section className="portfolio shell">
          <div className="section-head"><p className="eyebrow">05 / PORTFOLIO</p><h2>Products with<br /><em>real purpose.</em></h2></div>
          <Reveal className="portfolio-feature">
            <div><p className="eyebrow">PUBLIC PRODUCT / EDUCATION</p><h3>VidyaLuma</h3><p>AI-powered school and academic intelligence platform—built to bring better visibility and more useful context to education.</p><Link href="/products" className="text-link">Explore the portfolio <ArrowDownRight /></Link></div>
            <div className="portfolio-signal" aria-hidden="true"><Network /><span>PRODUCT<br />SYSTEM</span></div>
          </Reveal>
          <p className="portfolio-note">Additional products are developed and introduced only when ready for public disclosure.</p>
        </section>

        <section className="method-section shell">
          <div className="section-head"><p className="eyebrow">06 / HOW WE BUILD</p><h2>Careful by design.<br /><em>Connected by default.</em></h2></div>
          <ol>{buildApproach.map((step, index) => <Reveal key={step}><span>0{index + 1}</span><b>{step}</b><i aria-hidden="true" /></Reveal>)}</ol>
        </section>

        <section className="principles shell">
          <div className="section-head"><p className="eyebrow">07 / PRINCIPLES</p><h2>Made to hold up.</h2></div>
          <div>{companyNarrative.principles.map(([title, body], index) => <Reveal key={title} className="principle"><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></Reveal>)}</div>
        </section>

        <section className="operating-band">
          <div className="shell">
            <div className="section-head"><p className="eyebrow">08 / HOW KRAVIA OPERATES</p><h2>Confidence is<br /><em>built into the work.</em></h2></div>
            <div className="operating-grid">
              {operatingAreas.map(([title, copy, href], index) => <Reveal key={title} className="operating-card"><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p><Link href={href} className="text-link">Explore <ArrowDownRight /></Link></Reveal>)}
            </div>
          </div>
        </section>

        <section className="trust-band">
          <div className="shell trust-inner"><ShieldCheck size={32}/><div><p className="eyebrow">09 / TRUST & GOVERNANCE</p><h2>Private records stay private.<br />Public commitments stay clear.</h2></div><MagneticLink className="button button-dark premium-cta" href="/trust">Explore Trust Center <ArrowUpRight /></MagneticLink></div>
        </section>

        <section className="corporate-information shell" aria-labelledby="corporate-information-title">
          <div><p className="eyebrow">10 / CORPORATE INFORMATION</p><h2 id="corporate-information-title">Corporate details, <em>without the clutter.</em></h2><p>Kravia publishes public corporate information from a governed record. Details that are not yet verified are deliberately not shown.</p><Link href="/company/corporate-information" className="text-link">View corporate information <ArrowDownRight /></Link></div>
          <dl>{publicFactRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>

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
      <Footer />
    </>
  );
}
