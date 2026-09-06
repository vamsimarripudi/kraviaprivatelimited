export type VidyaLumaMarketEstimate = {
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
};

export type VidyaLumaMarketSeriesPoint = { year: number; valueUsdBn: number; derived: boolean };

export const vidyaLumaMarketResearchReviewedAt = "2026-09-06";

export const vidyaLumaMarketEstimates = {
  global: {
    source: "MarketsandMarkets",
    reportTitle: "EdTech and Smart Classrooms Market — Global Forecast to 2030",
    publishedAt: "2026-03",
    accessedAt: vidyaLumaMarketResearchReviewedAt,
    marketDefinition: "Global edtech and smart classrooms market. This broad category includes education technology and smart-classroom solutions; it is context, not a measure of VidyaLuma revenue or addressable demand.",
    baseYear: 2025,
    baseValueUsdBn: 197.3,
    forecastYear: 2030,
    forecastValueUsdBn: 353.1,
    cagr: 12.3,
    url: "https://www.marketsandmarkets.com/Market-Reports/educational-technology-ed-tech-market-1066.html",
  },
  india: {
    source: "Grand View Research",
    reportTitle: "India Education Technology Market Size & Outlook, 2025–2030",
    publishedAt: "2025",
    accessedAt: vidyaLumaMarketResearchReviewedAt,
    marketDefinition: "India education technology market. The source identifies K–12 as its largest revenue-generating sector in 2024; this is broader than school-operations software alone.",
    baseYear: 2024,
    baseValueUsdBn: 6.5954,
    forecastYear: 2030,
    forecastValueUsdBn: 17.0037,
    cagr: 16.9,
    url: "https://www.grandviewresearch.com/horizon/outlook/education-technology-market/india",
  },
} as const satisfies Record<string, VidyaLumaMarketEstimate>;

export function buildVidyaLumaForecastSeries(estimate: VidyaLumaMarketEstimate): VidyaLumaMarketSeriesPoint[] {
  return Array.from({ length: estimate.forecastYear - estimate.baseYear + 1 }, (_, index) => {
    const year = estimate.baseYear + index;
    if (year === estimate.baseYear) return { year, valueUsdBn: estimate.baseValueUsdBn, derived: false };
    if (year === estimate.forecastYear) return { year, valueUsdBn: estimate.forecastValueUsdBn, derived: false };
    return { year, valueUsdBn: Number((estimate.baseValueUsdBn * Math.pow(1 + estimate.cagr / 100, index)).toFixed(2)), derived: true };
  });
}

export const formatVidyaLumaUsdBn = (value: number) => `$${value.toFixed(value < 20 ? 2 : 1)}B`;
