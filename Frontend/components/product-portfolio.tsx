import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui";
import { ProductAnalytics, ProductTrackedLink } from "@/components/product-interactions";
import { getPublicPortfolio, type PublicPortfolioItem } from "@/lib/content/portfolio";

function productStatus(state: PublicPortfolioItem["state"]) {
  if (state === "ACTIVE") return { label: "Available", tone: "success" as const };
  if (state === "BETA") return { label: "Beta", tone: "information" as const };
  if (state === "COMING_SOON") return { label: "In development", tone: "information" as const };
  return { label: "Public profile", tone: "neutral" as const };
}

export async function ProductPortfolio({ products }: { products?: readonly PublicPortfolioItem[] }) {
  const portfolio = products ?? await getPublicPortfolio();
  if (!portfolio.length) return null;

  return <section className="product-portfolio-grid" aria-label="Kravia product portfolio">
    {portfolio.map((product) => {
      const status = productStatus(product.state);
      const label = `Explore ${product.name}`;
      const analyticsEvent = product.id === "vidyaluma" ? "vidyaluma_card_viewed" as const : product.id === "vorio" ? "vorio_card_viewed" as const : null;
      const ctaEvent = product.id === "vidyaluma" ? "vidyaluma_cta_clicked" as const : product.id === "vorio" ? "vorio_cta_clicked" as const : null;
      const hasAttribution = product.id === "vidyaluma" || product.id === "vorio";
      return <Card key={product.id} variant="product" interactive>
        {analyticsEvent && <ProductAnalytics event={analyticsEvent} product={product.id} />}
        <CardHeader><p className="eyebrow">{product.category}</p><Badge tone={status.tone}>{status.label}</Badge></CardHeader>
        <CardTitle>{product.name}</CardTitle>
        {hasAttribution && <p className="product-attribution">A product by Kravia</p>}
        <CardDescription>{product.description}</CardDescription>
        <CardFooter>{ctaEvent ? <ProductTrackedLink event={ctaEvent} product={product.id} href={product.href} className="text-link">{label} <ArrowUpRight aria-hidden="true" /></ProductTrackedLink> : product.href.startsWith("http") ? <a href={product.href} className="text-link">{label} <ArrowUpRight aria-hidden="true" /></a> : <Link href={product.href} className="text-link">{label} <ArrowUpRight aria-hidden="true" /></Link>}</CardFooter>
      </Card>;
    })}
  </section>;
}
