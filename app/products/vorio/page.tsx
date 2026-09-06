import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { BreadcrumbJsonLd, ProductJsonLd, WebPageJsonLd } from "@/components/structured-data";
import { VorioProductPage } from "@/components/vorio-product-page";
import { vorioProduct } from "@/lib/products/vorio";

export const metadata: Metadata = {
  title: { absolute: vorioProduct.seo.title },
  description: vorioProduct.seo.description,
  alternates: { canonical: "/products/vorio" },
  openGraph: { title: vorioProduct.seo.title, description: vorioProduct.seo.description, url: "/products/vorio", type: "website" },
  twitter: { card: "summary_large_image", title: vorioProduct.seo.title, description: vorioProduct.seo.description },
};

export default function VorioRoute() {
  return <><SiteNav /><BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Products", path: "/products" }, { name: "VORIO", path: "/products/vorio" }]} /><WebPageJsonLd name={vorioProduct.seo.title} description={vorioProduct.seo.description} path="/products/vorio" about="VORIO, a Kravia field-service dispatch and execution product in development." /><ProductJsonLd slug="vorio" /><VorioProductPage /><Footer /></>;
}
