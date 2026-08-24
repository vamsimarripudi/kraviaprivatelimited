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
  state: "ACTIVE" | "BETA" | "PUBLIC_PROFILE";
};

function fallbackPortfolio(): readonly PublicPortfolioItem[] {
  return publicProducts
    .filter((product) => product.public && ["ACTIVE", "BETA"].includes(product.status))
    .sort((left, right) => left.order - right.order)
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      href: product.website || "/products",
      state: product.status === "BETA" ? "BETA" : "ACTIVE",
    }));
}

/**
 * The public product portfolio is database-first: only an approved PRODUCT
 * publication is rendered. The verified local record keeps the known flagship
 * product visible before its first governed database publication is created.
 */
export const getPublicPortfolio = cache(async (): Promise<readonly PublicPortfolioItem[]> => {
  const records = await listPublishedContent("PRODUCT");
  if (!records.length) return fallbackPortfolio();

  return records.map((record) => ({
    id: record.id,
    name: record.title,
    category: record.category || "Product",
    description: record.summary || "Approved public product information.",
    href: publicContentPath(record),
    state: "PUBLIC_PROFILE",
  }));
});