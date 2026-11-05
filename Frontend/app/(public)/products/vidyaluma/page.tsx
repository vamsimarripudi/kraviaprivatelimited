import type { Metadata } from "next";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/structured-data";
import { VidyaLumaProductPage } from "@/components/vidyaluma-product-page";
import { vidyaLumaProduct } from "@/lib/products/vidyaluma";

export const metadata: Metadata = {
  title: vidyaLumaProduct.seo.title,
  description: vidyaLumaProduct.seo.description,
  alternates: { canonical: "/products/vidyaluma" },
  openGraph: { title: vidyaLumaProduct.seo.title, description: vidyaLumaProduct.seo.description, url: "/products/vidyaluma", type: "website" },
  twitter: { card: "summary", title: vidyaLumaProduct.seo.title, description: vidyaLumaProduct.seo.description },
};

export default function VidyaLumaRoute() {
  return <><BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Products", path: "/products" }, { name: "VidyaLuma", path: "/products/vidyaluma" }]} /><ProductJsonLd slug="vidyaluma" /><VidyaLumaProductPage /></>;
}