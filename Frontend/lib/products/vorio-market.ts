export type MarketEstimate = {
  id: string;
  source: string;
  reportTitle: string;
  publishedAt: string;
  accessedAt: string;
  marketDefinition: string;
  baseYear: number;
  baseValueUsdBn: number;
  forecastYear: number;
  forecastValueUsdBn: number;
  cagr: number;
  url: string;
  notes: string;
};

export type MarketSeriesPoint = { year: number; valueUsdBn: number; derived: boolean };

export const vorioMarketResearchReviewedAt = "2026-09-06";

export const vorioMarketEstimates: readonly MarketEstimate[] = [
  {
    id: "marketsandmarkets-global-2025-2030",
    source: "MarketsandMarkets",
    reportTitle: "Field Service Management Market by Solutions - Global Forecast to 2030",
    publishedAt: "2025-11",
    accessedAt: vorioMarketResearchReviewedAt,
    marketDefinition: "Global field service management market covering scheduling, dispatch and route optimisation, work order management, reporting, inventory, customer and service-contract management.",
    baseYear: 2025,
    baseValueUsdBn: 5.1,
    forecastYear: 2030,
    forecastValueUsdBn: 9.17,
    cagr: 12.5,
    url: "https://www.marketsandmarkets.com/Market-Reports/field-service-management-market-209977425.html",
    notes: "Selected for the primary global chart because the public summary discloses the base value, forecast value, period and CAGR.",
  },
  {
    id: "marketsandmarkets-us-2025-2030",
    source: "MarketsandMarkets",
    reportTitle: "US Field Service Management Market (2025-2030)",
    publishedAt: "2026-07",
    accessedAt: vorioMarketResearchReviewedAt,
    marketDefinition: "United States field service management market.",
    baseYear: 2025,
    baseValueUsdBn: 1.3822,
    forecastYear: 2030,
    forecastValueUsdBn: 2.1585,
    cagr: 9.3,
    url: "https://www.marketsandmarkets.com/Market-Reports/geography/field-service-management-market/US",
    notes: "Used for the US context card. Values are converted from the source's USD millions to USD billions.",
  },
  {
    id: "grand-view-global-2026-2033",
    source: "Grand View Research",
    reportTitle: "Field Service Management Market Size, Share & Trends Analysis Report, 2026-2033",
    publishedAt: "2026",
    accessedAt: vorioMarketResearchReviewedAt,
    marketDefinition: "Global field service management market across solutions, services, deployment models, enterprise sizes and end-use industries.",
    baseYear: 2026,
    baseValueUsdBn: 6.7,
    forecastYear: 2033,
    forecastValueUsdBn: 13.8,
    cagr: 11,
    url: "https://www.grandviewresearch.com/industry-analysis/field-service-management-market",
    notes: "The public summary also reports a USD 6.1B market size in 2025. Its period and definition differ from other providers.",
  },
  {
    id: "mordor-apac-2025-2030",
    source: "Mordor Intelligence",
    reportTitle: "Asia Pacific Field Service Management Market - Size, Share & Industry Trends",
    publishedAt: "2025-06-04",
    accessedAt: vorioMarketResearchReviewedAt,
    marketDefinition: "Asia Pacific field service management market.",
    baseYear: 2025,
    baseValueUsdBn: 2.61,
    forecastYear: 2030,
    forecastValueUsdBn: 6.41,
    cagr: 19.68,
    url: "https://www.mordorintelligence.com/industry-reports/asia-pacific-field-service-management-market",
    notes: "Used as APAC context. It is not an India-only estimate.",
  },
] as const;

export const selectedGlobalMarketEstimate = vorioMarketEstimates[0];
export const selectedUsMarketEstimate = vorioMarketEstimates[1];
export const selectedApacMarketEstimate = vorioMarketEstimates[3];

export function buildForecastSeries(estimate: MarketEstimate): MarketSeriesPoint[] {
  const points: MarketSeriesPoint[] = [];
  for (let year = estimate.baseYear; year <= estimate.forecastYear; year += 1) {
    if (year === estimate.baseYear) points.push({ year, valueUsdBn: estimate.baseValueUsdBn, derived: false });
    else if (year === estimate.forecastYear) points.push({ year, valueUsdBn: estimate.forecastValueUsdBn, derived: false });
    else {
      const value = estimate.baseValueUsdBn * Math.pow(1 + estimate.cagr / 100, year - estimate.baseYear);
      points.push({ year, valueUsdBn: Number(value.toFixed(2)), derived: true });
    }
  }
  return points;
}

export const formatUsdBn = (value: number, precision = 2) => `$${value.toFixed(precision)}B`;
export const selectedGlobalMarketSeries = buildForecastSeries(selectedGlobalMarketEstimate);
export const selectedGlobalGrowthIndex = Math.round((selectedGlobalMarketEstimate.forecastValueUsdBn / selectedGlobalMarketEstimate.baseValueUsdBn) * 100);
