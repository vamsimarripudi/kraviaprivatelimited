import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import type { PublicPortfolioItem } from "@/lib/content/portfolio";
import { marketContextForProductHref } from "@/lib/products/portfolio-market";

export function HomepageProductMarket({ products }: { products: readonly PublicPortfolioItem[] }) {
  const entries = products.flatMap((product) => {
    const context = marketContextForProductHref(product.href);
    return context ? [{ product, context }] : [];
  });

  if (!entries.length) return null;

  return <section className="homepage-product-market" aria-labelledby="portfolio-market-title">
    <header className="homepage-product-market-head">
      <div>
        <p className="eyebrow">PORTFOLIO / MARKET CONTEXT</p>
        <h3 id="portfolio-market-title">The opportunity needs<br /><em>the right context.</em></h3>
      </div>
      <p>Each product is supported by a reviewed market record. Estimates and forecasts are attributed to their publishers; they are not Kravia revenue, valuation, customer counts or a promise of demand.</p>
    </header>
    <div className="homepage-product-market-grid">
      {entries.map(({ product, context }) => <article key={context.productSlug}>
        <div className="homepage-product-market-topline"><span>{product.name}</span><span>{context.geography}</span></div>
        <h4>{context.marketLabel}</h4>
        <dl className="homepage-product-market-metrics">
          <div><dt>{context.baseYear} · {context.baseLabel}</dt><dd>{context.baseValue}</dd></div>
          <div><dt>{context.forecastYear} · {context.forecastLabel}</dt><dd>{context.forecastValue}</dd></div>
          {context.cagr ? <div><dt>Published growth</dt><dd>{context.cagr}</dd></div> : <div><dt>Forecast horizon</dt><dd>{context.baseYear}–{context.forecastYear}</dd></div>}
        </dl>
        <div className="homepage-product-market-track" aria-hidden="true"><i /><i /></div>
        <p className="homepage-product-market-note">{context.scopeNote}</p>
        <div className="homepage-product-market-links">
          <a href={context.sourceUrl} target="_blank" rel="noreferrer">Source: {context.source} <ArrowUpRight aria-hidden="true" /></a>
          <Link href={product.href}>Explore {product.name} <ChartNoAxesCombined aria-hidden="true" /></Link>
        </div>
        <p className="homepage-product-market-review">{context.sourceTitle} · Research reviewed {context.reviewedAt}</p>
      </article>)}
    </div>
  </section>;
}
