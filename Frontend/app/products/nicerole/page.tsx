import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SiteNav } from "@/components/site-nav";
import { BreadcrumbJsonLd, ProductJsonLd, WebPageJsonLd } from "@/components/structured-data";
import { RecruitFlowProductPage } from "@/components/recruitflow-product-page";
import { recruitFlowProduct } from "@/lib/products/recruitflow";

export const metadata: Metadata = {
  title: { absolute: recruitFlowProduct.seo.title },
  description: recruitFlowProduct.seo.description,
  alternates: { canonical: "/products/nicerole" },
  openGraph: {
    title: recruitFlowProduct.seo.title,
    description: recruitFlowProduct.seo.description,
    url: "/products/nicerole",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: recruitFlowProduct.seo.title,
    description: recruitFlowProduct.seo.description,
  },
};

export default function NiceRoleRoute() {
  return <>
    <SiteNav />
    <BreadcrumbJsonLd items={[
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
      { name: "Nice Role", path: "/products/nicerole" },
    ]} />
    <WebPageJsonLd
      name={recruitFlowProduct.seo.title}
      description={recruitFlowProduct.seo.description}
      path="/products/nicerole"
      about="Nice Role, a Kravia recruitment operations platform for structured hiring workflows."
    />
    <ProductJsonLd slug="nicerole" />
    <RecruitFlowProductPage />
    <Footer />
  </>;
}
