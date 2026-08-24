import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui";
import { getPublicPortfolio, type PublicPortfolioItem } from "@/lib/content/portfolio";

function productStatus(state: PublicPortfolioItem["state"]) {
  if (state === "ACTIVE") return { label: "Available", tone: "success" as const };
  if (state === "BETA") return { label: "Beta", tone: "information" as const };
  return { label: "Public profile", tone: "neutral" as const };
}

export async function ProductPortfolio({ products }: { products?: readonly PublicPortfolioItem[] }) {
  const portfolio = products ?? await getPublicPortfolio();
  if (!portfolio.length) return null;

  return <section className="product-portfolio-grid" aria-label="Kravia product portfolio">
    {portfolio.map((product) => {
      const status = productStatus(product.state);
      return <Card key={product.id} variant="product" interactive>
        <CardHeader><p className="eyebrow">{product.category}</p><Badge tone={status.tone}>{status.label}</Badge></CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
        <CardFooter>{product.href.startsWith("http") ? <a href={product.href} className="text-link">Explore {product.name} <ArrowUpRight aria-hidden="true" /></a> : <Link href={product.href} className="text-link">Explore {product.name} <ArrowUpRight aria-hidden="true" /></Link>}</CardFooter>
      </Card>;
    })}
  </section>;
}
