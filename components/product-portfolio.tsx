import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { publicProducts } from "@/lib/corporate-content";
import { Badge, Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui";

function productStatus(status: (typeof publicProducts)[number]["status"]) {
  if (status === "ACTIVE") return { label: "Available", tone: "success" as const };
  if (status === "BETA") return { label: "Beta", tone: "information" as const };
  return { label: "Public information pending", tone: "neutral" as const };
}

export function ProductPortfolio() {
  const products = publicProducts.filter((product) => product.public && ["ACTIVE", "BETA"].includes(product.status));
  if (!products.length) return null;

  return <section className="product-portfolio-grid" aria-label="Kravia product portfolio">
    {products.map((product) => {
      const status = productStatus(product.status);
      return <Card key={product.id} variant="product" interactive>
        <CardHeader><p className="eyebrow">{product.category}</p><Badge tone={status.tone}>{status.label}</Badge></CardHeader>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
        <CardFooter>{product.website ? <a href={product.website} className="text-link">Explore {product.name} <ArrowUpRight aria-hidden="true" /></a> : <Link href="/contact" className="text-link">Discuss {product.name} <ArrowUpRight aria-hidden="true" /></Link>}</CardFooter>
      </Card>;
    })}
  </section>;
}
