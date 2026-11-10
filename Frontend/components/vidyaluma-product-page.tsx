import Image from "next/image";
import { ArrowDownRight, ArrowUpRight, BrainCircuit, Building2, LockKeyhole, Network, ShieldCheck, UsersRound, Workflow } from "lucide-react";
import { Accordion } from "@/components/ui";
import { ProductAnalytics, ProductTrackedLink } from "@/components/product-interactions";
import { vidyaLumaProduct } from "@/lib/products/vidyaluma";
import { VidyaLumaMarketChart } from "@/components/vidyaluma-market-chart";

const contactHref = "/contact?product=vidyaluma#enquiry-form";
const platformIcons = [Building2, BrainCircuit, UsersRound, Workflow] as const;

export function VidyaLumaProductPage() {
  return <main id="main-content" className="vidyaluma-page">
    <ProductAnalytics event="vidyaluma_product_view" product="vidyaluma" />
    <section className="vidyaluma-hero">
      <div className="shell vidyaluma-hero-grid">
        <div>
          <p className="eyebrow">{vidyaLumaProduct.hero.eyebrow}</p>
          <div className="vidyaluma-logo-lockup"><Image className="vidyaluma-logo" src="/products/vidyaluma/vidyaluma-logo.jpg" width={1024} height={1024} priority sizes="(max-width: 620px) 92vw, (max-width: 980px) 34rem, 36rem" alt="VidyaLuma — Connected School Intelligence" /></div>
          <h1>{vidyaLumaProduct.hero.title}</h1>
          <p className="vidyaluma-lede">{vidyaLumaProduct.hero.intro}</p>
          <div className="vidyaluma-actions">
            <ProductTrackedLink event="vidyaluma_cta_clicked" product="vidyaluma" href={vidyaLumaProduct.website} external className="button button-dark">Visit VidyaLuma <ArrowUpRight aria-hidden="true" /></ProductTrackedLink>
            <ProductTrackedLink event="vidyaluma_enquiry_started" product="vidyaluma" href={contactHref} className="text-link">Talk to Kravia <ArrowDownRight aria-hidden="true" /></ProductTrackedLink>
          </div>
        </div>
        <aside className="vidyaluma-hero-aside">
          <span aria-hidden="true">V</span>
          <div><p>PRODUCT PORTFOLIO</p><strong>Education technology</strong><small>Independent product brand · Built by Kravia</small></div>
        </aside>
      </div>
    </section>

    <section className="vidyaluma-overview shell" aria-labelledby="vidyaluma-overview-title">
      <p className="eyebrow">01 / PRODUCT OVERVIEW</p>
      <h2 id="vidyaluma-overview-title">One connected system for the work that helps <em>schools move forward.</em></h2>
      <p>{vidyaLumaProduct.overview}</p>
      <p>Explore the published <a href="https://vidyaluma.in/product" target="_blank" rel="noopener noreferrer">product overview</a>, <a href="https://vidyaluma.in/solutions" target="_blank" rel="noopener noreferrer">school use cases</a>, <a href="https://vidyaluma.in/pricing" target="_blank" rel="noopener noreferrer">school plans</a> and <a href="https://vidyaluma.in/trust" target="_blank" rel="noopener noreferrer">trust policies</a>. Public examples use fictional data; current feature access depends on the school plan and enabled modules.</p>
    </section>


    <section className="vidyaluma-section vidyaluma-platform" aria-labelledby="vidyaluma-market-title">
      <div className="shell">
        <header className="vidyaluma-section-head"><div><p className="eyebrow">02 / MARKET CONTEXT</p><h2 id="vidyaluma-market-title">A growing education technology <em>context.</em></h2></div><p>VidyaLuma is focused on connected school operations. The market data below describes wider education-technology categories, and is not a statement of product revenue, market share or guaranteed demand.</p></header>
        <VidyaLumaMarketChart />
      </div>
    </section>

    <section className="vidyaluma-section vidyaluma-platform" aria-labelledby="vidyaluma-platform-title">
      <div className="shell">
        <header className="vidyaluma-section-head"><div><p className="eyebrow">03 / PLATFORM AREAS</p><h2 id="vidyaluma-platform-title">Intelligence where it helps.<br /><em>Clarity where it matters.</em></h2></div><p>VidyaLuma connects the school day: attendance and exceptions, academic tasks, fee visibility, approved reports and role-specific communication. Each area has a responsible user and clear access boundaries.</p></header>
        <div className="vidyaluma-area-grid">
          {vidyaLumaProduct.platformAreas.map((area, index) => {
            const Icon = platformIcons[index];
            return <article key={area.title}><Icon aria-hidden="true" /><span>0{index + 1}</span><h3>{area.title}</h3><p>{area.summary}</p><ul>{area.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></article>;
          })}
        </div>
      </div>
    </section>

    <section className="vidyaluma-section shell vidyaluma-approach" aria-labelledby="vidyaluma-approach-title">
      <header className="vidyaluma-section-head"><div><p className="eyebrow">04 / PLATFORM APPROACH</p><h2 id="vidyaluma-approach-title">Built for responsible school <em>operations.</em></h2></div><p>The platform is designed for school owners, principals, administrators, teachers, students and authorised family report recipients. Every role should see only the information and actions appropriate to its school context.</p></header>
      <div className="vidyaluma-principle-grid">{vidyaLumaProduct.platformPrinciples.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>

    <section className="vidyaluma-section vidyaluma-intelligence" aria-labelledby="vidyaluma-intelligence-title">
      <div className="shell vidyaluma-intelligence-grid"><BrainCircuit aria-hidden="true" /><div><p className="eyebrow">05 / AI-ASSISTED INTELLIGENCE</p><h2 id="vidyaluma-intelligence-title">Intelligence with <em>human judgement intact.</em></h2><p>The published teacher workflow includes scanning corrected answer sheets, confirming student identity and linking the pages to academic records. AI-assisted observations support report preparation, but an authorised educator must review and approve reports before release.</p><p>Academic reports are not medical or psychological diagnoses. Automation must not replace classroom judgement, school approvals or appropriate human accountability.</p></div></div>
    </section>

    <section className="vidyaluma-section shell vidyaluma-trust" aria-labelledby="vidyaluma-trust-title">
      <header className="vidyaluma-section-head"><div><p className="eyebrow">06 / GOVERNED FOUNDATION</p><h2 id="vidyaluma-trust-title">A product architecture that keeps the school context <em>in view.</em></h2></div></header>
      <div className="vidyaluma-trust-grid"><article><LockKeyhole aria-hidden="true" /><h3>Access with context</h3><p>School-scoped roles separate leadership, administration, teaching and student work. Parents receive only approved report access, not unrestricted school accounts.</p></article><article><ShieldCheck aria-hidden="true" /><h3>Workflows with accountability</h3><p>Attendance exceptions, examination records, staff actions and report approvals are designed to remain traceable to the appropriate school authority.</p></article><article><Network aria-hidden="true" /><h3>Reporting with continuity</h3><p>School-authorised reports can be shared through restricted links with controls such as expiry and view or download permissions, where enabled.</p></article></div>
    </section>

    <section className="vidyaluma-interest"><div className="shell vidyaluma-interest-inner"><div><p className="eyebrow">VIDYALUMA / BY KRAVIA</p><h2>Explore the product, or start a <em>considered conversation.</em></h2><p>VidyaLuma is an independent product brand developed by KRAVIA PRIVATE LIMITED. Schools can explore published subscription plans and request a guided walkthrough; enrolment and payment follow verified onboarding steps.</p></div><div><ProductTrackedLink event="vidyaluma_cta_clicked" product="vidyaluma" href={vidyaLumaProduct.website} external className="button button-light">Visit VidyaLuma <ArrowUpRight aria-hidden="true" /></ProductTrackedLink><ProductTrackedLink event="vidyaluma_enquiry_started" product="vidyaluma" href={contactHref} className="text-link inverse-link">Product enquiry <ArrowUpRight aria-hidden="true" /></ProductTrackedLink></div></div></section>

    <section className="vidyaluma-section shell vidyaluma-faq" aria-labelledby="vidyaluma-faq-title"><header className="vidyaluma-section-head"><div><p className="eyebrow">07 / FAQ</p><h2 id="vidyaluma-faq-title">Practical answers for schools.</h2></div></header><Accordion label="VidyaLuma frequently asked questions" entries={vidyaLumaProduct.faqs.map(([title, content]) => ({ title, content: <p>{content}</p> }))} /></section>
  </main>;
}
