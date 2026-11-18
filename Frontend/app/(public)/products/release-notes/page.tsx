import type { Metadata } from "next";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/structured-data";
import { ProductReleaseNotes } from "@/components/product-release-notes";

const title = "Product Release Notes & Development Updates | KRAVIA";
const description = "Read reviewed KRAVIA product updates, including VidyaLuma Connect development progress, engineering scope, availability and release-readiness work.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: {
    canonical: "/products/release-notes",
    types: { "application/rss+xml": "/products/release-notes/rss.xml" },
  },
  openGraph: { siteName: "KRAVIA", title, description, url: "/products/release-notes", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ProductReleaseNotesRoute() {
  return <>
    <BreadcrumbJsonLd items={[
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
      { name: "Release notes", path: "/products/release-notes" },
    ]} />
    <WebPageJsonLd name={title} description={description} path="/products/release-notes" about="Reviewed engineering updates and product release information from KRAVIA PRIVATE LIMITED." />
    <ProductReleaseNotes />
  </>;
}
