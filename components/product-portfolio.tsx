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
      const isVidyaLuma = product.id === "vidyaluma";
      return <Card key={product.id} variant="product" interactive>
        {isVidyaLuma && <ProductAnalytics event="vidyaluma_card_viewed" product="vidyaluma" />}
        <CardHeader><p className="eyebrow">{product.category}</p><Badge tone={status.tone}>{status.label}</Badge></CardHeader>
        <CardTitle>{product.name}</CardTitle>
        {isVidyaLuma && <p className="product-attribution">A product by Kravia</p>}
        <CardDescription>{product.description}</CardDescription>
        <CardFooter>{isVidyaLuma
          ? <ProductTrackedLink event="vidyaluma_cta_clicked" product="vidyaluma" href={product.href} className="text-link">{label} <ArrowUpRight aria-hidden="true" /></ProductTrackedLink>
          : product.href.startsWith("http")
            ? <a href={product.href} className="text-link">{label} <ArrowUpRight aria-hidden="true" /></a>
            : <Link href={product.href} className="text-link">{label} <ArrowUpRight aria-hidden="true" /></Link>}
        </CardFooter>
      </Card>;
    })}
  </section>;
}