import { describe, expect, it } from "vitest";
import { marketContextForProductHref, portfolioMarketContexts } from "../lib/products/portfolio-market";

describe("homepage product market context", () => {
  it("projects exactly the three approved product research records", () => {
    expect(portfolioMarketContexts.map((context) => context.productSlug)).toEqual(["vidyaluma", "yukta", "vorio"]);
    expect(portfolioMarketContexts.every((context) => context.sourceUrl.startsWith("https://"))).toBe(true);
    expect(portfolioMarketContexts.every((context) => context.forecastYear > context.baseYear)).toBe(true);
  });

  it("maps canonical corporate product routes without inventing market context", () => {
    expect(marketContextForProductHref("/products/vidyaluma")?.source).toBe("MarketsandMarkets");
    expect(marketContextForProductHref("/products/yukta")?.geography).toBe("India");
    expect(marketContextForProductHref("/products/vorio")?.forecastValue).toBe("$9.17B");
    expect(marketContextForProductHref("/products/unknown")).toBeUndefined();
  });
});
