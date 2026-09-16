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
    </section>


    <section className="vidyaluma-section vidyaluma-platform" aria-labelledby="vidyaluma-market-title">
      <div className="shell">
        <header className="vidyaluma-section-head"><div><p className="eyebrow">02 / MARKET CONTEXT</p><h2 id="vidyaluma-market-title">A growing education technology <em>context.</em></h2></div><p>VidyaLuma is focused on connected school operations. The market data below describes wider education-technology categories, and is not a statement of product revenue, market share or guaranteed demand.</p></header>
        <VidyaLumaMarketChart />
      </div>
    </section>

    <section className="vidyaluma-section vidyaluma-platform" aria-labelledby="vidyaluma-platform-title">
      <div className="shell">
        <header className="vidyaluma-section-head"><div><p className="eyebrow">03 / PLATFORM AREAS</p><h2 id="vidyaluma-platform-title">Intelligence where it helps.<br /><em>Clarity where it matters.</em></h2></div><p>VidyaLuma brings key school operations into a shared product foundation without turning every workflow into a technical exercise.</p></header>
        <div className="vidyaluma-area-grid">
          {vidyaLumaProduct.platformAreas.map((area, index) => {
            const Icon = platformIcons[index];
            return <article key={area.title}><Icon aria-hidden="true" /><span>0{index + 1}</span><h3>{area.title}</h3><p>{area.summary}</p><ul>{area.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></article>;
          })}
        </div>
      </div>
    </section>

    <section className="vidyaluma-section shell vidyaluma-approach" aria-labelledby="vidyaluma-approach-title">
      <header className="vidyaluma-section-head"><div><p className="eyebrow">04 / PLATFORM APPROACH</p><h2 id="vidyaluma-approach-title">Built for responsible school <em>operations.</em></h2></div><p>VidyaLuma’s product direction treats access, workflow ownership and operational context as part of the experience—not separate afterthoughts.</p></header>
      <div className="vidyaluma-principle-grid">{vidyaLumaProduct.platformPrinciples.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>

    <section className="vidyaluma-section vidyaluma-intelligence" aria-labelledby="vidyaluma-intelligence-title">
      <div className="shell vidyaluma-intelligence-grid"><BrainCircuit aria-hidden="true" /><div><p className="eyebrow">05 / AI-ASSISTED INTELLIGENCE</p><h2 id="vidyaluma-intelligence-title">Intelligence with <em>human judgement intact.</em></h2><p>VidyaLuma is designed to support analysis, learning intelligence, evaluation workflows, reporting and operational insight. It does not replace teachers, school leadership or authorised human decision-making.</p><p>Automation should make the next responsible action clearer—not hide who is accountable.</p></div></div>
    </section>

    <section className="vidyaluma-section shell vidyaluma-trust" aria-labelledby="vidyaluma-trust-title">
      <header className="vidyaluma-section-head"><div><p className="eyebrow">06 / GOVERNED FOUNDATION</p><h2 id="vidyaluma-trust-title">A product architecture that keeps the school context <em>in view.</em></h2></div></header>
      <div className="vidyaluma-trust-grid"><article><LockKeyhole aria-hidden="true" /><h3>Access with context</h3><p>Role-based access supports a more deliberate relationship between a person, their responsibilities and the school information they need.</p></article><article><ShieldCheck aria-hidden="true" /><h3>Workflows with accountability</h3><p>School operations can remain visible, governed and reviewable without losing usability for the people doing the work.</p></article><article><Network aria-hidden="true" /><h3>Reporting with continuity</h3><p>Connected records and reporting are designed to reduce fragmented operational views across the school experience.</p></article></div>
    </section>

    <section className="vidyaluma-interest"><div className="shell vidyaluma-interest-inner"><div><p className="eyebrow">VIDYALUMA / BY KRAVIA</p><h2>Explore the product, or start a <em>considered conversation.</em></h2><p>VidyaLuma remains its own product experience. Kravia provides the corporate context behind the product.</p></div><div><ProductTrackedLink event="vidyaluma_cta_clicked" product="vidyaluma" href={vidyaLumaProduct.website} external className="button button-light">Visit VidyaLuma <ArrowUpRight aria-hidden="true" /></ProductTrackedLink><ProductTrackedLink event="vidyaluma_enquiry_started" product="vidyaluma" href={contactHref} className="text-link inverse-link">Product enquiry <ArrowUpRight aria-hidden="true" /></ProductTrackedLink></div></div></section>

    <section className="vidyaluma-section shell vidyaluma-faq" aria-labelledby="vidyaluma-faq-title"><header className="vidyaluma-section-head"><div><p className="eyebrow">07 / FAQ</p><h2 id="vidyaluma-faq-title">A clear product boundary.</h2></div></header><Accordion label="VidyaLuma frequently asked questions" entries={vidyaLumaProduct.faqs.map(([title, content]) => ({ title, content: <p>{content}</p> }))} /></section>
  </main>;
}
