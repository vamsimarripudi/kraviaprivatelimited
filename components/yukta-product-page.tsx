import { ArrowDownRight, ArrowUpRight, Building2, CalendarDays, ClipboardCheck, CreditCard, FileText, HeartPulse, LockKeyhole, Network, ReceiptText, ShieldCheck, Sparkles, Stethoscope, UsersRound, Workflow } from "lucide-react";
import { Accordion } from "@/components/ui";
import { ProductAnalytics, ProductTrackedLink } from "@/components/product-interactions";
import { yuktaProduct } from "@/lib/products/yukta";
import Link from "next/link";
import styles from "./yukta-research.module.css";
import { YuktaProblem, YuktaResearch } from "@/components/yukta-research";
import { yuktaBuyerFaqs } from "@/lib/products/yukta-research";

const contactHref = "/contact?product=yukta#enquiry-form";
const workflowIcons = [UsersRound, CalendarDays, Building2, ClipboardCheck, Workflow, Stethoscope, FileText, HeartPulse, CreditCard, ReceiptText, Network] as const;
const securityPrinciples = [
  ["Tenant isolation", "Keep organisational data separated by design."],
  ["Role-aware access", "Make access match the responsibility and task at hand."],
  ["Traceable actions", "Keep significant operational actions legible and auditable."],
  ["Consent-aware workflows", "Support clear handling of patient and information choices."],
  ["Controlled document access", "Design access to sensitive records with appropriate safeguards."],
  ["Data lifecycle awareness", "Treat retention, review and removal as governed work."],
] as const;
const queueSignals = [
  ["Live waiting state", "A visible view of where a patient is in the arrival-to-visit journey."],
  ["Resource-aware flow", "Queue decisions can account for the doctor or resource responsible for the next handoff."],
  ["Recovery in view", "Call next, skip, recall and reconnect patterns support calm recovery when the day changes."],
] as const;

export function YuktaProductPage() {
  return <main id="main-content" className="yukta-page">
    <ProductAnalytics event="yukta_product_view" product="yukta" />
    <section className="yukta-hero">
      <div className="shell yukta-hero-grid">
        <div>
          <nav aria-label="Breadcrumb" className={styles.anchorNav}><Link href="/products">Products</Link><span aria-current="page">YUKTA</span></nav><p className="eyebrow">{yuktaProduct.hero.eyebrow} · A product by Kravia Private Limited</p>
          <h1>{yuktaProduct.hero.title}</h1>
          <p className="yukta-lede">{yuktaProduct.hero.intro}</p>
          <div className="yukta-actions">
            <ProductTrackedLink product="yukta" event="yukta_explore_clicked" href="#platform" className="button button-dark">Explore the platform <ArrowDownRight aria-hidden="true" /></ProductTrackedLink>
            <ProductTrackedLink product="yukta" event="yukta_contact_clicked" href={contactHref} className="text-link">Contact Kravia <ArrowUpRight aria-hidden="true" /></ProductTrackedLink>
          </div>
        </div>
        <aside className="yukta-hero-mark" aria-label="YUKTA V1 product status">
          <span>Y</span>
          <div><p>YUKTA V1</p><strong>In development</strong><small>Healthcare operating platform</small></div>
        </aside>
      </div>
    </section>

    <section className="yukta-identity shell" aria-labelledby="yukta-identity-title">
      <p className="eyebrow">YUKTA / PRODUCT IDENTITY</p>
      <h2 id="yukta-identity-title">A unified healthcare operating platform for <em>modern clinics and hospitals.</em></h2>
      <p>YUKTA V1 is being designed for clinics and outpatient operations in small hospitals in India. The capabilities below describe documented design, not general availability or a verified production release.</p>
    </section>

    <nav aria-label="On this page" className={`shell ${styles.anchorNav}`}><a href="#problem">The problem</a><a href="#platform">Workflow</a><a href="#market">Market evidence</a><a href="#adoption">Adoption</a><a href="#yukta-faq-title">FAQ</a></nav><YuktaProblem />

    <section id="platform" className="yukta-section yukta-workflow" aria-labelledby="workflow-title">
      <div className="shell">
        <header className="yukta-section-head"><div><p className="eyebrow">01 / HEALTHCARE WORKFLOW</p><h2 id="workflow-title">The work stays connected <em>from arrival to continuity.</em></h2></div><p>YUKTA is designed around real handoffs—not a collection of disconnected tools.</p></header>
        <p>Workflow illustration · Intended operational handoffs, not a live patient queue.</p><ol className="yukta-workflow-list">
          {yuktaProduct.workflow.map((step, index) => {
            const Icon = workflowIcons[index];
            return <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" /><strong>{step}</strong></li>;
          })}
        </ol>
      </div>
    </section>

    <section className="yukta-section shell" aria-labelledby="capabilities-title">
      <header className="yukta-section-head"><div><p className="eyebrow">02 / CORE PLATFORM CAPABILITIES</p><h2 id="capabilities-title">Operational depth, <em>without operational noise.</em></h2></div><p>Each platform area is designed to make the next responsible action clearer.</p></header>
      <Accordion label="YUKTA core platform capabilities" entries={yuktaProduct.capabilityGroups.map((group) => ({ title: group.title, content: <div className="yukta-capability-content"><p>{group.summary}</p><ul>{group.pillars.map((pillar) => <li key={pillar}>{pillar}</li>)}</ul></div> }))} />
    </section>

    <section className="yukta-section yukta-queue" aria-labelledby="queue-title">
      <div className="shell yukta-queue-grid">
        <div><p className="eyebrow">03 / SMART QUEUE MANAGEMENT</p><h2 id="queue-title">A queue with context.<br /><em>Not guesswork.</em></h2><p>Give front-desk and operations teams clear patient-flow visibility while supporting the real decisions needed when a schedule moves.</p></div>
        <div className="yukta-signal-grid">{queueSignals.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </div>
    </section>

    <section className="yukta-section shell yukta-clinical" aria-labelledby="clinical-title">
      <header className="yukta-section-head"><div><p className="eyebrow">04 / CLINICAL WORKFLOW</p><h2 id="clinical-title">Designed to assist workflows.<br /><em>Never replace clinical authority.</em></h2></div><p>Doctors and authorised healthcare professionals retain clinical decision authority at every material step.</p></header>
      <p>V1 preserves paper-first consultation where needed. Assistants may coordinate records, but cannot make clinical decisions. A report being ready is distinct from a doctor having reviewed it.</p><ol className="yukta-clinical-flow"><li>Consultation</li><li>Investigation</li><li>Report</li><li>Doctor review</li><li>Authorised record</li><li>Follow-up</li></ol>
    </section>

    <section className="yukta-section yukta-billing" aria-labelledby="billing-title">
      <div className="shell yukta-billing-grid"><div><p className="eyebrow">05 / BILLING & REVENUE OPERATIONS</p><h2 id="billing-title">Care operations and revenue operations, <em>in one coordinated view.</em></h2></div><div><ol><li>Visit</li><li>Charge capture</li><li>Billing</li><li>Payment</li><li>Reconciliation</li><li>Invoice / receipt</li></ol><p>Connect operational and financial workflows without creating disconnected billing silos.</p></div></div>
    </section>

    <section className="yukta-section shell" aria-labelledby="interoperability-title">
      <div className="yukta-feature-grid"><article><Network aria-hidden="true" /><p className="eyebrow">06 / INTEROPERABILITY</p><h2 id="interoperability-title">Integration-ready by direction.</h2><p>YUKTA is designed for standards-based healthcare interoperability and integration-ready workflows. ABDM/FHIR connectivity and insurance/TPA/NHCX workflows are outside V1 availability. Architecture direction is not certification, approval or production connectivity.</p></article><article><ShieldCheck aria-hidden="true" /><p className="eyebrow">07 / PRIVACY, SECURITY & GOVERNANCE</p><h2>Controls belong in the foundation.</h2><p>Privacy-by-design principles, clear accountability and secure handling patterns are intended to shape the platform from the start.</p></article></div>
      <div className="yukta-security-grid">{securityPrinciples.map(([title, copy]) => <article key={title}><LockKeyhole aria-hidden="true" /><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>

    <section className="yukta-section yukta-ai" aria-labelledby="ai-title"><div className="shell yukta-ai-grid"><Sparkles aria-hidden="true" /><div><p className="eyebrow">08 / GOVERNED AI</p><h2 id="ai-title">AI with <em>boundaries.</em></h2><p>YUKTA’s assistance is designed to operate through defined permissions, provenance, human oversight and domain authority. Its intended role is administrative assistance. Clinical interpretation, diagnosis, prescribing, treatment recommendations and clinical authorization are excluded; operational workflows must not depend on AI availability.</p><p>It is not an AI doctor, an autonomous diagnostic system or an autonomous treatment recommendation system.</p></div></div></section>

    <section className="yukta-section shell" aria-labelledby="audience-title"><header className="yukta-section-head"><div><p className="eyebrow">09 / WHO YUKTA IS FOR</p><h2 id="audience-title">Built around the people who keep care <em>moving.</em></h2></div></header><ul className="yukta-audience-list">{yuktaProduct.audiences.map((audience) => <li key={audience}>{audience}</li>)}</ul></section>

    <YuktaResearch />

    <section className="yukta-early-access"><div className="shell yukta-early-access-inner"><div><p className="eyebrow">YUKTA V1 / EARLY ACCESS</p><h2>Built deliberately for its first <em>production deployments.</em></h2><p>Discuss the operating context, workflow needs and future fit with Kravia through the existing controlled enquiry workflow.</p></div><ProductTrackedLink product="yukta" event="yukta_early_access_clicked" href={contactHref} className="button button-light">Discuss early access <ArrowUpRight aria-hidden="true" /></ProductTrackedLink></div></section>

    <section className="yukta-section shell yukta-faq" aria-labelledby="yukta-faq-title"><header className="yukta-section-head"><div><p className="eyebrow">10 / FAQ</p><h2 id="yukta-faq-title">Clear answers, <em>without inflated claims.</em></h2></div></header><Accordion label="YUKTA frequently asked questions" entries={[...yuktaProduct.faqs.filter(([title]) => title !== "Who is YUKTA designed for?" && title !== "Can YUKTA support multiple facilities?"), ...yuktaBuyerFaqs].map(([title, content]) => ({ title, content: <p>{content}</p> }))} /></section>

    <section className="yukta-final"><div className="shell yukta-final-inner"><div><p className="eyebrow">YUKTA / KRAVIA HEALTHCARE</p><h2>One coordinated platform for <em>the work behind care.</em></h2></div><ProductTrackedLink product="yukta" event="yukta_contact_clicked" href={contactHref} className="button button-light">Talk to Kravia <ArrowUpRight aria-hidden="true" /></ProductTrackedLink></div></section>
  </main>;
}