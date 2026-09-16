import { describe, expect, it } from "vitest";
import { publicProducts } from "../lib/corporate-content";
import { selectedGlobalMarketEstimate, selectedGlobalMarketSeries, selectedUsMarketEstimate, vorioMarketEstimates } from "../lib/products/vorio-market";
import { vorioProduct } from "../lib/products/vorio";

describe("VORIO public product record", () => {
  it("is a public Kravia product with an honest availability state and canonical route", () => {
    expect(publicProducts).toContainEqual(vorioProduct);
    expect(vorioProduct.href).toBe("/products/vorio");
    expect(vorioProduct.status).toBe("COMING_SOON");
    expect(vorioProduct.enquiryCategory).toContain("VORIO");
  });

  it("keeps the product and emergency-service boundaries explicit", () => {
    const copy = JSON.stringify(vorioProduct).toLowerCase();
    expect(copy).toContain("not a substitute for public emergency services");
    expect(copy).toContain("not presented as an autonomous decision-maker");
    expect(copy).not.toContain("trusted by");
    expect(copy).not.toContain("certified");
  });

  it("uses sourced market endpoints and labelled derived intermediate points", () => {
    expect(selectedGlobalMarketEstimate.baseValueUsdBn).toBe(5.1);
    expect(selectedGlobalMarketEstimate.forecastValueUsdBn).toBe(9.17);
    expect(selectedGlobalMarketSeries.at(0)?.derived).toBe(false);
    expect(selectedGlobalMarketSeries.at(-1)?.derived).toBe(false);
    expect(selectedGlobalMarketSeries.slice(1, -1).every((point) => point.derived)).toBe(true);
    expect(selectedUsMarketEstimate.forecastValueUsdBn).toBe(2.1585);
    expect(vorioMarketEstimates).toHaveLength(4);
  });
});
