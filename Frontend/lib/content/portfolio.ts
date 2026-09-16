import "server-only";

import { cache } from "react";
import { publicProducts } from "@/lib/corporate-content";

import { listPublishedContent } from "./repository";
import { publicContentPath } from "./seo";

export type PublicPortfolioItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  href: string;
  state: "ACTIVE" | "BETA" | "COMING_SOON" | "PUBLIC_PROFILE";
};

function fallbackPortfolio(): readonly PublicPortfolioItem[] {
  return publicProducts
    .filter((product) => product.public && ["ACTIVE", "BETA", "COMING_SOON"].includes(product.status))
    .sort((left, right) => left.order - right.order)
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      href: product.href ?? product.website ?? "/products",
      state: product.status === "BETA" ? "BETA" : product.status === "COMING_SOON" ? "COMING_SOON" : "ACTIVE",
    }));
}

/**
 * Published product records take priority. Approved local records remain visible
 * until their first governed public database record is released.
 */
export const getPublicPortfolio = cache(async (): Promise<readonly PublicPortfolioItem[]> => {
  const records = await listPublishedContent("PRODUCT");
  const published = records.map((record) => ({
    id: record.id,
    name: record.title,
    category: record.category || "Product",
    description: record.summary || "Approved public product information.",
    href: publicContentPath(record),
    state: "PUBLIC_PROFILE" as const,
  }));
  const publishedSlugs = new Set(records.map((record) => record.slug));

  return [...published, ...fallbackPortfolio().filter((product) => !publishedSlugs.has(product.id))];
});