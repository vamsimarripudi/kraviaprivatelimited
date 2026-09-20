import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarCheck2,
  ChartNoAxesCombined,
  FileSearch2,
  LockKeyhole,
  MessageSquareText,
  Network,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Accordion } from "@/components/ui";
import { ProductAnalytics, ProductTrackedLink } from "@/components/product-interactions";
import { recruitFlowProduct } from "@/lib/products/recruitflow";
import {
  formatRecruitFlowMarketValue,
  recruitFlowMarketEstimates,
  recruitFlowMarketResearchReviewedAt,
} from "@/lib/products/recruitflow-market";
import styles from "./recruitflow-product-page.module.css";

const contactHref = "/contact?product=nicerole#enquiry-form";
const capabilityIcons = [BriefcaseBusiness, UsersRound, CalendarCheck2, BrainCircuit, Smartphone, ChartNoAxesCombined] as const;

export function RecruitFlowProductPage() {
  return <main id="main-content" className={styles.page}>
    <ProductAnalytics event="recruitflow_product_view" product="recruitflow" />

    <section className={styles.hero}>
      <div className={`shell ${styles.heroGrid}`}>
        <div>
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/products">Products</Link><span aria-current="page">Nice Role</span></nav>
          <p className="eyebrow">{recruitFlowProduct.hero.eyebrow}</p>
          <p className={styles.wordmark} aria-label="Nice Role">Nice <span>Role</span></p>
          <h1>{recruitFlowProduct.hero.title}</h1>
          <p className={styles.lede}>{recruitFlowProduct.hero.intro}</p>
          <div className={styles.actions}>
            <ProductTrackedLink
              event="recruitflow_cta_clicked"
              product="recruitflow"
              href={recruitFlowProduct.website}
              external
              className="button button-light"
            >
              Open Nice Role <ArrowUpRight aria-hidden="true" />
            </ProductTrackedLink>
            <ProductTrackedLink
              event="recruitflow_contact_clicked"
              product="recruitflow"
              href={contactHref}
              className={`text-link ${styles.inverseLink}`}
            >
              Talk to Kravia <ArrowDownRight aria-hidden="true" />
            </ProductTrackedLink>
          </div>
        </div>

        <aside className={styles.signal} aria-label="Nice Role product status">
          <div><span>NR / RECRUITMENT OPERATIONS</span><strong>Public beta</strong></div>
          <div className={styles.flow} aria-hidden="true"><i /><i /><i /><i /><b /></div>
          <p><span>Role</span><span>Evidence</span><span>Decision</span></p>
        </aside>
      </div>
    </section>

    <section className={`shell ${styles.overview}`} aria-labelledby="recruitflow-overview-title">
      <div><p className="eyebrow">01 / PRODUCT OVERVIEW</p><h2 id="recruitflow-overview-title">Recruitment operations with a clearer <em>system of record.</em></h2></div>
      <div>
        <p>Nice Role is an India-focused recruitment SaaS operated by Kravia Private Limited. It connects recruiter work across company onboarding, roles, applications, candidate evidence, interviews, scorecards, outcomes, communications, analytics and subscription state.</p>
        <p>The product is built around a deliberate boundary: software can organise evidence and workflow, but authorised people remain responsible for consequential hiring decisions.</p>
      </div>
    </section>

    <section className={styles.workflowSection} aria-labelledby="recruitflow-workflow-title">
      <div className="shell">
        <header className={styles.sectionHead}>
          <div><p className="eyebrow">02 / HIRING WORKFLOW</p><h2 id="recruitflow-workflow-title">From open role to candidate outcome, <em>without losing the history between steps.</em></h2></div>
          <p>Nice Role separates internal evaluation, candidate-facing communication and platform state so each part of the hiring process stays legible.</p>
        </header>
        <ol className={styles.workflowGrid}>
          {recruitFlowProduct.workflow.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>)}
        </ol>
      </div>
    </section>

    <section className={`shell ${styles.section}`} aria-labelledby="recruitflow-capabilities-title">
      <header className={styles.sectionHead}>
        <div><p className="eyebrow">03 / PRODUCT CAPABILITIES</p><h2 id="recruitflow-capabilities-title">The recruiting workspace, candidate context and operating controls <em>in one product.</em></h2></div>
        <p>These capabilities are based on the implemented Nice Role repository and its current MVP scope rather than a generic recruitment-software feature list.</p>
      </header>
      <div className={styles.capabilityGrid}>
        {recruitFlowProduct.capabilityGroups.map((group, index) => {
          const Icon = capabilityIcons[index];
          return <article key={group.title}>
            <span>0{index + 1}</span>
            <Icon aria-hidden="true" />
            <h3>{group.title}</h3>
            <p>{group.summary}</p>
            <ul>{group.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
          </article>;
        })}
      </div>
    </section>

    <section id="market" className={styles.market} aria-labelledby="recruitflow-market-title">
      <div className="shell">
        <header className={styles.sectionHead}>
          <div><p className="eyebrow">04 / MARKET EVIDENCE</p><h2 id="recruitflow-market-title">Published market numbers, <em>with the scope left visible.</em></h2></div>
          <p>The estimates below come from named research publishers. They describe broader market categories, not Nice Role revenue, valuation, market share, customer count or guaranteed demand.</p>
        </header>

        <div className={styles.marketGrid}>
          {recruitFlowMarketEstimates.map((estimate) => <article key={estimate.id}>
            <div className={styles.marketTopline}><span>{estimate.geography}</span><span>{estimate.cagr}% CAGR</span></div>
            <h3>{estimate.market}</h3>
            <div className={styles.marketNumbers}>
              <div><small>{estimate.baseYear} · published estimate</small><strong>{formatRecruitFlowMarketValue(estimate.baseValue, estimate.baseUnit)}</strong></div>
              <i aria-hidden="true" />
              <div><small>{estimate.forecastYear} · publisher forecast</small><strong>{formatRecruitFlowMarketValue(estimate.forecastValue, estimate.forecastUnit)}</strong></div>
            </div>
            <p>{estimate.scopeNote}</p>
            <a href={estimate.url} target="_blank" rel="noreferrer">Source: {estimate.source} <ArrowUpRight aria-hidden="true" /></a>
          </article>)}
        </div>

        <aside className={styles.marketMethod}>
          <FileSearch2 aria-hidden="true" />
          <div>
            <h3>Why the numbers are not collapsed into one TAM</h3>
            <p>ATS, recruitment software and online recruitment technology are related but differently defined research categories. Nice Role publishes each source separately so methodology differences remain visible instead of producing a synthetic number that no publisher actually reported.</p>
            <small>Research reviewed {recruitFlowMarketResearchReviewedAt}. Exact endpoints above are publisher-reported; no intermediate annual values are invented.</small>
          </div>
        </aside>

        <div className={styles.sourceLedger}>
          {recruitFlowMarketEstimates.map((estimate) => <div key={estimate.id}>
            <span>{estimate.source}</span>
            <strong>{estimate.reportTitle}</strong>
            <p>{estimate.notes}</p>
          </div>)}
        </div>
      </div>
    </section>

    <section className={styles.boundary} aria-labelledby="recruitflow-boundary-title">
      <div className={`shell ${styles.boundaryGrid}`}>
        <BrainCircuit aria-hidden="true" />
        <div>
          <p className="eyebrow">05 / INTELLIGENCE WITH A HUMAN DECISION BOUNDARY</p>
          <h2 id="recruitflow-boundary-title">Evidence can be organised.<br /><em>Hiring authority stays human.</em></h2>
          <p>Nice Role can extract resume information and calculate deterministic matching evidence to help authorised recruiters review applicants. It does not independently hire, reject, disqualify or publish a consequential outcome.</p>
          <p>A human hiring decision is recorded separately from candidate-facing outcome publication, preserving accountability in the workflow.</p>
        </div>
      </div>
    </section>

    <section className={`shell ${styles.section}`} aria-labelledby="recruitflow-standards-title">
      <header className={styles.sectionHead}>
        <div><p className="eyebrow">06 / PRODUCT STANDARDS</p><h2 id="recruitflow-standards-title">Important boundaries are part of <em>the product model.</em></h2></div>
        <p>Nice Role treats privacy, tenancy, application history and decision accountability as operating rules rather than marketing statements.</p>
      </header>
      <div className={styles.principleGrid}>
        {recruitFlowProduct.principles.map(([title, copy], index) => <article key={title}>
          {index === 0 ? <LockKeyhole aria-hidden="true" /> : index === 1 ? <UserCheck aria-hidden="true" /> : index === 2 ? <ShieldCheck aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}
          <span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p>
        </article>)}
      </div>
    </section>

    <section className={styles.audience} aria-labelledby="recruitflow-audience-title">
      <div className="shell">
        <header className={styles.sectionHead}>
          <div><p className="eyebrow">07 / WHO NICE ROLE IS FOR</p><h2 id="recruitflow-audience-title">For teams that need hiring structure <em>without enterprise clutter.</em></h2></div>
          <p>Nice Role is positioned for Indian hiring teams that need a more accountable process across roles, candidates, interviews and outcomes.</p>
        </header>
        <ul>{recruitFlowProduct.audiences.map((audience) => <li key={audience}>{audience}</li>)}</ul>
      </div>
    </section>

    <section className={styles.platform} aria-labelledby="recruitflow-platform-title">
      <div className={`shell ${styles.platformGrid}`}>
        <div>
          <p className="eyebrow">08 / PLATFORM FOOTPRINT</p>
          <h2 id="recruitflow-platform-title">Recruiter web, candidate mobile and governed services <em>working from one operating model.</em></h2>
          <p>The current architecture combines a recruiter web application, candidate Expo application, Express API, Supabase PostgreSQL/Auth/private storage and a Python/FastAPI intelligence service.</p>
        </div>
        <div className={styles.stack}>
          <article><Workflow aria-hidden="true" /><span>Recruiter web</span></article>
          <article><Smartphone aria-hidden="true" /><span>Candidate mobile</span></article>
          <article><Network aria-hidden="true" /><span>API + data</span></article>
          <article><MessageSquareText aria-hidden="true" /><span>Communications</span></article>
        </div>
      </div>
    </section>

    <section className={`shell ${styles.section} ${styles.faq}`} aria-labelledby="recruitflow-faq-title">
      <header className={styles.sectionHead}><div><p className="eyebrow">09 / FAQ</p><h2 id="recruitflow-faq-title">Clear answers about the <em>product boundary.</em></h2></div></header>
      <Accordion label="Nice Role frequently asked questions" entries={recruitFlowProduct.faqs.map(([title, content]) => ({ title, content: <p>{content}</p> }))} />
    </section>

    <section className={styles.final}>
      <div className={`shell ${styles.finalInner}`}>
        <div><p className="eyebrow">NICE ROLE / A KRAVIA PRODUCT</p><h2>Give hiring one accountable <em>system of record.</em></h2><p>Explore the Nice Role application or talk to Kravia about product fit.</p></div>
        <div className={styles.finalActions}>
          <ProductTrackedLink event="recruitflow_cta_clicked" product="recruitflow" href={recruitFlowProduct.website} external className="button button-light">Open Nice Role <ArrowUpRight aria-hidden="true" /></ProductTrackedLink>
          <ProductTrackedLink event="recruitflow_contact_clicked" product="recruitflow" href={contactHref} className={`text-link ${styles.inverseLink}`}>Product enquiry <ArrowUpRight aria-hidden="true" /></ProductTrackedLink>
        </div>
      </div>
    </section>
  </main>;
}
