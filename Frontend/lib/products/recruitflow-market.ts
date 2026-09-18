export type RecruitFlowMarketEstimate = {
  id: string;
  geography: string;
  market: string;
  source: string;
  reportTitle: string;
  baseYear: number;
  baseValue: number;
  baseUnit: "USD_BN" | "USD_MN";
  forecastYear: number;
  forecastValue: number;
  forecastUnit: "USD_BN" | "USD_MN";
  cagr: number;
  url: string;
  scopeNote: string;
  notes: string;
};

export const recruitFlowMarketResearchReviewedAt = "2026-09-19";

export const recruitFlowMarketEstimates: readonly RecruitFlowMarketEstimate[] = [
  {
    id: "marketsandmarkets-global-ats-2025-2030",
    geography: "Global",
    market: "Applicant tracking system market",
    source: "MarketsandMarkets",
    reportTitle: "Applicant Tracking System Market by Offering, Functionality - Global Forecast to 2030",
    baseYear: 2025,
    baseValue: 3.28,
    baseUnit: "USD_BN",
    forecastYear: 2030,
    forecastValue: 4.88,
    forecastUnit: "USD_BN",
    cagr: 8.2,
    url: "https://www.marketsandmarkets.com/Market-Reports/applicant-tracking-system-market-27004100.html",
    scopeNote: "Core ATS category covering job posting/distribution, resume parsing and sourcing, interview management, candidate relationship management, reporting and analytics.",
    notes: "The public report summary also gives a 2024 market size of USD 2.97B and identifies Asia Pacific as the fastest-growing region.",
  },
  {
    id: "imarc-india-recruitment-software-2025-2034",
    geography: "India",
    market: "Recruitment software market",
    source: "IMARC Group",
    reportTitle: "India Recruitment Software Market Size, Share, Trends and Forecast 2026-2034",
    baseYear: 2025,
    baseValue: 81.6,
    baseUnit: "USD_MN",
    forecastYear: 2034,
    forecastValue: 122.9,
    forecastUnit: "USD_MN",
    cagr: 4.52,
    url: "https://www.imarcgroup.com/india-recruitment-software-market",
    scopeNote: "India recruitment-software category spanning resume management, mobile recruitment, reporting and analytics, workflow management and services.",
    notes: "The source reports SaaS-based deployment at 70% of the India market in 2025 and software at 65% of market revenue.",
  },
  {
    id: "fortune-global-online-recruitment-tech-2026-2034",
    geography: "Global",
    market: "Online recruitment technology market",
    source: "Fortune Business Insights",
    reportTitle: "Online Recruitment Technology Market Size, Share & Industry Analysis, 2026-2034",
    baseYear: 2026,
    baseValue: 17.48,
    baseUnit: "USD_BN",
    forecastYear: 2034,
    forecastValue: 46.07,
    forecastUnit: "USD_BN",
    cagr: 12.9,
    url: "https://www.fortunebusinessinsights.com/online-recruitment-market-103730",
    scopeNote: "Broader recruitment-technology category including chatbots, candidate relationship management, applicant tracking and AI-based video interviewing.",
    notes: "The source reports the market at USD 15.18B in 2025 before its 2026 estimate of USD 17.48B.",
  },
] as const;

export const selectedRecruitFlowIndiaEstimate = recruitFlowMarketEstimates[1];

export function formatRecruitFlowMarketValue(value: number, unit: RecruitFlowMarketEstimate["baseUnit"]) {
  return unit === "USD_BN" ? `$${value.toFixed(2)}B` : `$${value.toFixed(1)}M`;
}
