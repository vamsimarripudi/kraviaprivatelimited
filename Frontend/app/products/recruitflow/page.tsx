import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { BreadcrumbJsonLd, ProductJsonLd, WebPageJsonLd } from "@/components/structured-data";
import { RecruitFlowProductPage } from "@/components/recruitflow-product-page";
import { recruitFlowProduct } from "@/lib/products/recruitflow";

export const metadata: Metadata = {
  title: { absolute: recruitFlowProduct.seo.title },
  description: recruitFlowProduct.seo.description,
  alternates: { canonical: "/products/recruitflow" },
  openGraph: {
    title: recruitFlowProduct.seo.title,
    description: recruitFlowProduct.seo.description,
    url: "/products/recruitflow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: recruitFlowProduct.seo.title,
    description: recruitFlowProduct.seo.description,
  },
};

export default function RecruitFlowRoute() {
  return <>
    <SiteNav />
    <BreadcrumbJsonLd items={[
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
      { name: "RecruitFlow", path: "/products/recruitflow" },
    ]} />
    <WebPageJsonLd
      name={recruitFlowProduct.seo.title}
      description={recruitFlowProduct.seo.description}
      path="/products/recruitflow"
      about="RecruitFlow, a Kravia recruitment operations platform for structured hiring workflows."
    />
    <ProductJsonLd slug="recruitflow" />
    <RecruitFlowProductPage />
    <Footer />
  </>;
}
