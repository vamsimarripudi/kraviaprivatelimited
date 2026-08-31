import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/structured-data";
import { YuktaProductPage } from "@/components/yukta-product-page";
import { yuktaProduct } from "@/lib/products/yukta";

export const metadata: Metadata = {
  title: yuktaProduct.seo.title,
  description: yuktaProduct.seo.description,
  alternates: { canonical: "/products/yukta" },
  openGraph: { title: yuktaProduct.seo.title, description: yuktaProduct.seo.description, url: "/products/yukta", type: "website" },
  twitter: { card: "summary", title: yuktaProduct.seo.title, description: yuktaProduct.seo.description },
};

export default function YuktaRoute() {
  return <><SiteNav /><BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Products", path: "/products" }, { name: "YUKTA", path: "/products/yukta" }]} /><ProductJsonLd slug="yukta" /><YuktaProductPage /><Footer /></>;
}