import Link from "next/link";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { PageHero } from "@/components/motion";
import { SocialLinks } from "@/components/social-links";
import { BreadcrumbJsonLd } from "@/components/structured-data";
import { companyFaqDescription, companyFaqPath, companyFaqs, discoveryProducts } from "@/lib/public-discovery";
import { buildPublicMetadata, serializeJsonLd } from "@/lib/search-metadata";
import { siteUrl } from "@/lib/site";
import styles from "./page.module.css";

export const metadata = {
  ...buildPublicMetadata({ title: "Company questions and answers", description: companyFaqDescription, path: companyFaqPath }),
  alternates: { canonical: companyFaqPath, types: { "text/markdown": "/company/faq.md" } },
};

export default function CompanyFaqPage() {
  const questions = companyFaqs();
  const schema = {
    "@context": "https://schema.org", "@type": "FAQPage", "@id": `${siteUrl}${companyFaqPath}#faq`,
    url: `${siteUrl}${companyFaqPath}`, isPartOf: { "@id": `${siteUrl}#website` },
    publisher: { "@id": `${siteUrl}#organization` },
    mainEntity: questions.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
  return <>
    <SiteNav />
    <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Company", path: "/company" }, { name: "Questions and answers", path: companyFaqPath }]} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    <main id="main-content">
      <PageHero eyebrow="Company / Questions and answers" title="Clear answers. Official sources." intro={companyFaqDescription} />
      <div className={`shell ${styles.content}`}>
        <section aria-label="Company questions and answers" className={styles.answers}>
          {questions.map((item) => <section key={item.id} id={item.id} aria-labelledby={`${item.id}-title`} className={styles.answer}>
            <h2 id={`${item.id}-title`}>{item.question}</h2><p>{item.answer}</p><Link href={item.source}>{item.sourceLabel}</Link>
          </section>)}
        </section>
        <section aria-labelledby="public-product-information" className={styles.products}>
          <h2 id="public-product-information">Public product information</h2>
          {discoveryProducts().map((product) => <article key={product.href} className={styles.product}>
            <h3><Link href={product.href}>{product.name}</Link></h3><p>{product.description}</p>
            <p className={styles.status}>{product.category} · {product.status}</p><Link href={product.href}>Product information</Link>
          </article>)}
        </section>
        <section aria-labelledby="faq-social-title" className={styles.channels}><h2 id="faq-social-title">Official corporate social channels</h2><SocialLinks labelled /></section>
        <p className={styles.formats}>Other formats: <a href="/company/faq.md" type="text/markdown">Markdown</a> · <a href="/llms.txt">Public reading guide</a></p>
      </div>
    </main>
    <Footer />
  </>;
}
