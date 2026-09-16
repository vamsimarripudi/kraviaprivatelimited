import { describe, expect, it } from "vitest";
import { buildVidyaLumaForecastSeries, vidyaLumaMarketEstimates } from "../lib/products/vidyaluma-market";

describe("VidyaLuma market registry", () => {
  it("preserves published endpoints and labels intermediate values as derived", () => {
    for (const estimate of Object.values(vidyaLumaMarketEstimates)) {
      const series = buildVidyaLumaForecastSeries(estimate);
      expect(series.at(0)).toMatchObject({ year: estimate.baseYear, valueUsdBn: estimate.baseValueUsdBn, derived: false });
      expect(series.at(-1)).toMatchObject({ year: estimate.forecastYear, valueUsdBn: estimate.forecastValueUsdBn, derived: false });
      expect(series.slice(1, -1).every((point) => point.derived)).toBe(true);
      expect(estimate.url).toMatch(/^https:\/\//);
    }
  });
});
