import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Boxes, BrainCircuit, Network, ShieldCheck } from "lucide-react";
import { HomepageReveal } from "./homepage-reveal";
import { CapabilityExplorer, MagneticLink } from "./premium-interactions";
import { ProductAnalytics, ProductTrackedLink } from "./product-interactions";
import { ProductPortfolio } from "./product-portfolio";
import { HomepageProductMarket } from "./homepage-product-market";
import { HomepageUpdates } from "./newsroom-content";
import { companyNarrative } from "@/lib/corporate-content";
import { siteUrl } from "@/lib/site";
import { leadershipAssets } from "@/lib/leadership";
import type { PublicCompanyProfile } from "@/lib/corporate/public-facts";
import type { PublicPortfolioItem } from "@/lib/content/portfolio";
import type { PublicContentRecord } from "@/lib/content/types";
import styles from "./homepage-body.module.css";

const disciplines = [
  { title: "Software products", copy: "Proprietary platforms for real workflows, designed for repeated use and long-term value.", Icon: Boxes },
  { title: "Intelligent systems", copy: "AI-assisted capabilities developed inside our products, with people accountable for decisions.", Icon: BrainCircuit },
  { title: "Digital infrastructure", copy: "Application services, secure data and infrastructure behind our software platforms.", Icon: Network },
] as const;
const operatingAreas = [
  ["Company", "An Indian private limited company developing and operating its own products.", "/company/about"],
  ["Technology", "Software architecture, APIs and infrastructure supporting proprietary platforms.", "/technology/engineering"],
  ["Governance", "Clear records, thoughtful controls and accountable ways of working.", "/governance"],
] as const;
const buildApproach = ["Understand", "Design", "Engineer", "Protect", "Learn", "Improve"];

function facts(profile: PublicCompanyProfile) {
  return [
    ["Legal name", profile.legalName], ["Entity type", profile.companyType],
    ["Country", profile.country], ["CIN", profile.cin],
    ["Registered office", profile.registeredOffice], ["Official website", siteUrl],
    ["Email", profile.corporateEmail], ["Telephone", profile.telephone],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
}

export function HomepageBody({ profile, products, newsroom }: {
  profile: PublicCompanyProfile;
  products: readonly PublicPortfolioItem[];
  newsroom: readonly PublicContentRecord[];
}) {
  const featured = products[0];
  const isVidyaLuma = featured?.id === "vidyaluma";
  const logo = leadershipAssets.vidyalumaLogo;
  const glance = [
    ["Identity", profile.legalName], ["Base", profile.country],
    ["Focus", "Proprietary software platforms · Product-led development"],
    ["Flagship product", featured?.name],
  ].filter(([, value]) => Boolean(value));

  return <div className={styles.body}>
    <section className={`${styles.container} ${styles.glance}`} aria-labelledby="glance-title">
      <div><p className={styles.eyebrow}>01 / AT A GLANCE</p><h2 id="glance-title">A product company<br /><em>with a clear purpose.</em></h2></div>
      <dl>{glance.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>

    <section className={`${styles.container} ${styles.story}`} aria-labelledby="story-title">
      <HomepageReveal className={styles.storyCopy}>
        <p className={styles.eyebrow}>02 / WHO WE ARE</p>
        <h2 id="story-title">Independent company.<br /><em>Proprietary products.</em></h2>
        <p className={styles.description}>{companyNarrative.summary}</p>
        <Link href="/company/about" className={styles.link}>Meet Kravia <ArrowUpRight aria-hidden="true" /></Link>
      </HomepageReveal>
      <HomepageReveal className={styles.systemVisual} delay={120}>
        <div className={styles.systemGrid} aria-hidden="true" />
        <div className={styles.systemCore} aria-hidden="true"><Network strokeWidth={1} /><span>KRAVIA</span></div>
        <div className={styles.systemLabels} aria-hidden="true"><span>PRODUCTS</span><span>SYSTEMS</span><span>INFRASTRUCTURE</span></div>
        <p>One product-led company.<br /><strong>Distinct platforms and users.</strong></p>
      </HomepageReveal>
    </section>

    <section className={styles.build} data-nav-theme="dark" aria-labelledby="build-title">
      <div className={styles.container}>
        <HomepageReveal className={styles.sectionHead}><p className={styles.eyebrow}>03 / WHAT WE BUILD</p><h2 id="build-title">Software products for<br /><em>the work people do.</em></h2></HomepageReveal>
        <div className={styles.disciplines}>{disciplines.map(({ title, copy, Icon }, index) => <HomepageReveal as="article" key={title} className={styles.discipline} delay={index * 80}>
          <div className={styles.disciplineTop}><Icon aria-hidden="true" strokeWidth={1.3} /><span>0{index + 1}</span></div>
          <h3>{title}</h3><p>{copy}</p><span className={styles.drawLine} aria-hidden="true" />
        </HomepageReveal>)}</div>
      </div>
    </section>

    <section className={`${styles.container} ${styles.purpose}`} aria-labelledby="purpose-title">
      <HomepageReveal><p className={styles.eyebrow}>04 / WHY KRAVIA EXISTS</p><h2 id="purpose-title">{companyNarrative.purpose}</h2></HomepageReveal>
      <div className={styles.purposeDetails}><HomepageReveal delay={80}><span className={styles.eyebrow}>MISSION</span><p>{companyNarrative.mission}</p></HomepageReveal><HomepageReveal delay={160}><span className={styles.eyebrow}>VISION</span><p>{companyNarrative.vision}</p></HomepageReveal></div>
    </section>
    <HomepageReveal className={styles.capabilities}><CapabilityExplorer /></HomepageReveal>

    <section id="products" className={`${styles.container} ${styles.portfolio}`} aria-labelledby="products-title">
      <HomepageReveal className={styles.sectionHead}><p className={styles.eyebrow}>05 / PORTFOLIO</p><h2 id="products-title">Products with<br /><em>real purpose.</em></h2></HomepageReveal>
      {featured ? <HomepageReveal className={styles.feature}>
        {isVidyaLuma && <ProductAnalytics event="vidyaluma_card_viewed" product="vidyaluma" />}
        <div className={styles.featureCopy}>
          <p className={styles.eyebrow}>{featured.category}</p>
          <h3>{featured.name}</h3>
          {isVidyaLuma && <p className={styles.attribution}>A product by Kravia</p>}
          <span className={styles.productState}>{featured.state === "ACTIVE" ? "Available" : featured.state === "BETA" ? "Beta" : featured.state === "COMING_SOON" ? "In development" : "Public profile"}</span>
          <p>{featured.description}</p>
          {isVidyaLuma ? <ProductTrackedLink event="vidyaluma_cta_clicked" product="vidyaluma" href={featured.href} className={styles.link}>Explore {featured.name} <ArrowUpRight aria-hidden="true" /></ProductTrackedLink> : <Link href={featured.href} className={styles.link}>Explore {featured.name} <ArrowUpRight aria-hidden="true" /></Link>}
        </div>
        <div className={styles.productVisual}>
          <div className={styles.productRings} aria-hidden="true"><i /><i /><i /></div>
          {isVidyaLuma && logo ? <Image src={logo.src} width={logo.width} height={logo.height} alt="VidyaLuma — a product by Kravia" sizes="(max-width: 700px) 240px, 300px" /> : <Network size={100} strokeWidth={1} aria-hidden="true" />}
          <span className={styles.productVisualLabel}>THE KRAVIA PORTFOLIO</span>
        </div>
      </HomepageReveal> : null}
      {products.length > 1 ? <ProductPortfolio products={products.slice(1)} /> : null}
      <p className={styles.portfolioNote}>KRAVIA develops the platforms in this portfolio. Their status labels distinguish available, beta and in-development products; a public profile is not a launch claim.</p>
      <HomepageReveal><HomepageProductMarket products={products} /></HomepageReveal>
    </section>

    <section className={`${styles.container} ${styles.method}`} aria-labelledby="method-title">
      <HomepageReveal className={styles.sectionHead}><p className={styles.eyebrow}>06 / HOW WE BUILD</p><h2 id="method-title">Careful by design.<br /><em>Connected by default.</em></h2></HomepageReveal>
      <ol>{buildApproach.map((step, index) => <HomepageReveal as="li" key={step} delay={index * 45}><span>0{index + 1}</span><h3>{step}</h3><ArrowUpRight aria-hidden="true" /></HomepageReveal>)}</ol>
    </section>

    <section className={`${styles.container} ${styles.principles}`} aria-labelledby="principles-title">
      <HomepageReveal className={styles.principleIntro}><p className={styles.eyebrow}>07 / PRINCIPLES</p><h2 id="principles-title">Made to<br /><em>hold up.</em></h2><span className={styles.principleMark} aria-hidden="true"><ShieldCheck strokeWidth={0.8} /></span></HomepageReveal>
      <div>{companyNarrative.principles.map(([title, copy], index) => <HomepageReveal key={title} className={styles.principle} delay={Math.min(index * 45, 180)}><span>0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></HomepageReveal>)}</div>
    </section>

    <section className={styles.operations} aria-labelledby="operations-title">
      <div className={styles.container}>
        <HomepageReveal className={styles.sectionHead}><p className={styles.eyebrow}>08 / HOW KRAVIA OPERATES</p><h2 id="operations-title">Confidence is<br /><em>built into the work.</em></h2></HomepageReveal>
        <div className={styles.operationsGrid}>{operatingAreas.map(([title, copy, href], index) => <HomepageReveal key={title} delay={index * 80}>
          <Link href={href} className={styles.operationLink}><span className={styles.operationIndex}>0{index + 1}<ArrowUpRight aria-hidden="true" /></span><h3>{title}</h3><p>{copy}</p><span className={styles.operationAction}>Explore {title.toLowerCase()} <ArrowDownRight aria-hidden="true" /></span></Link>
        </HomepageReveal>)}</div>
      </div>
    </section>

    <HomepageReveal as="section" className={`${styles.container} ${styles.trust}`} aria-labelledby="trust-title">
      <ShieldCheck className={styles.trustIcon} strokeWidth={1.2} aria-hidden="true" />
      <div><p className={styles.eyebrow}>09 / TRUST & GOVERNANCE</p><h2 id="trust-title">Private records stay private.<br /><em>Public commitments stay clear.</em></h2></div>
      <MagneticLink className={styles.link} href="/trust">Explore Trust Center <ArrowUpRight aria-hidden="true" /></MagneticLink>
    </HomepageReveal>
    {newsroom.length > 0 && <HomepageReveal className={styles.newsroom}><HomepageUpdates articles={newsroom} /></HomepageReveal>}
    <section className={`${styles.container} ${styles.corporate}`} aria-labelledby="corporate-information-title">
      <HomepageReveal><p className={styles.eyebrow}>10 / CORPORATE INFORMATION</p><h2 id="corporate-information-title">Corporate details,<br /><em>without the clutter.</em></h2><p>Kravia publishes public corporate information from a governed record. Details that are not yet verified are deliberately not shown.</p><Link href="/company/corporate-information" className={styles.link}>View corporate information <ArrowUpRight aria-hidden="true" /></Link></HomepageReveal>
      <dl>{facts(profile).map(([label, value], index) => <HomepageReveal key={label} delay={Math.min(index * 30, 180)}><dt>{label}</dt><dd>{value}</dd></HomepageReveal>)}</dl>
    </section>
  </div>;
}
