import { vidyaLumaMarketEstimates, vidyaLumaMarketResearchReviewedAt } from "./vidyaluma-market";
import { formatRecruitFlowMarketValue, recruitFlowMarketResearchReviewedAt, selectedRecruitFlowIndiaEstimate } from "./recruitflow-market";
import { selectedGlobalMarketEstimate, vorioMarketResearchReviewedAt } from "./vorio-market";
import { researchCheckedAt, yuktaMetrics, yuktaSources } from "./yukta-research";

export type PortfolioMarketContext = {
  productSlug: "vidyaluma" | "recruitflow" | "yukta" | "vorio";
  marketLabel: string;
  geography: string;
  baseYear: number;
  baseValue: string;
  baseLabel: "Publisher estimate";
  forecastYear: number;
  forecastValue: string;
  forecastLabel: "Publisher forecast";
  cagr?: string;
  source: string;
  sourceTitle: string;
  sourceUrl: string;
  reviewedAt: string;
  scopeNote: string;
};

const yuktaIndiaEstimate = yuktaMetrics.find((metric) => metric.id === "india-pms-2024");
const yuktaIndiaForecast = yuktaMetrics.find((metric) => metric.id === "india-pms-2030");
const yuktaIndiaSource = yuktaSources.find((source) => source.id === "gvr-india");

if (!yuktaIndiaEstimate || !yuktaIndiaForecast || !yuktaIndiaSource) {
  throw new Error("YUKTA homepage market context requires its approved research registry.");
}

/**
 * Homepage market cards are projections of the reviewed per-product research
 * registries. They deliberately do not contain Kravia or product revenue.
 */
export const portfolioMarketContexts: readonly PortfolioMarketContext[] = [
  {
    productSlug: "vidyaluma",
    marketLabel: "Education technology market",
    geography: "Global",
    baseYear: vidyaLumaMarketEstimates.global.baseYear,
    baseValue: `${vidyaLumaMarketEstimates.global.baseValueUsdBn.toFixed(1)}B`,
    baseLabel: "Publisher estimate",
    forecastYear: vidyaLumaMarketEstimates.global.forecastYear,
    forecastValue: `${vidyaLumaMarketEstimates.global.forecastValueUsdBn.toFixed(1)}B`,
    forecastLabel: "Publisher forecast",
    cagr: `${vidyaLumaMarketEstimates.global.cagr}% CAGR`,
    source: vidyaLumaMarketEstimates.global.source,
    sourceTitle: vidyaLumaMarketEstimates.global.reportTitle,
    sourceUrl: vidyaLumaMarketEstimates.global.url,
    reviewedAt: vidyaLumaMarketResearchReviewedAt,
    scopeNote: "Broad education technology and smart-classroom context; not VidyaLuma revenue, market share or demand.",
  },
  {
    productSlug: "recruitflow",
    marketLabel: "Recruitment software market",
    geography: "India",
    baseYear: selectedRecruitFlowIndiaEstimate.baseYear,
    baseValue: formatRecruitFlowMarketValue(selectedRecruitFlowIndiaEstimate.baseValue, selectedRecruitFlowIndiaEstimate.baseUnit),
    baseLabel: "Publisher estimate",
    forecastYear: selectedRecruitFlowIndiaEstimate.forecastYear,
    forecastValue: formatRecruitFlowMarketValue(selectedRecruitFlowIndiaEstimate.forecastValue, selectedRecruitFlowIndiaEstimate.forecastUnit),
    forecastLabel: "Publisher forecast",
    cagr: `${selectedRecruitFlowIndiaEstimate.cagr}% CAGR`,
    source: selectedRecruitFlowIndiaEstimate.source,
    sourceTitle: selectedRecruitFlowIndiaEstimate.reportTitle,
    sourceUrl: selectedRecruitFlowIndiaEstimate.url,
    reviewedAt: recruitFlowMarketResearchReviewedAt,
    scopeNote: "Broader India recruitment-software context; not RecruitFlow revenue, market share, customer count or a guarantee of demand.",
  },
  {
    productSlug: "yukta",
    marketLabel: "Practice-management systems market",
    geography: "India",
    baseYear: Number(yuktaIndiaEstimate.period),
    baseValue: `$${yuktaIndiaEstimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}M`,
    baseLabel: "Publisher estimate",
    forecastYear: Number(yuktaIndiaForecast.period),
    forecastValue: `$${yuktaIndiaForecast.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}M`,
    forecastLabel: "Publisher forecast",
    source: yuktaIndiaSource.publisher,
    sourceTitle: yuktaIndiaSource.title,
    sourceUrl: yuktaIndiaSource.url,
    reviewedAt: researchCheckedAt,
    scopeNote: "Software and services context that is broader than YUKTA V1; not YUKTA revenue, valuation or clinical evidence.",
  },
  {
    productSlug: "vorio",
    marketLabel: "Field service management market",
    geography: "Global",
    baseYear: selectedGlobalMarketEstimate.baseYear,
    baseValue: `$${selectedGlobalMarketEstimate.baseValueUsdBn.toFixed(2)}B`,
    baseLabel: "Publisher estimate",
    forecastYear: selectedGlobalMarketEstimate.forecastYear,
    forecastValue: `$${selectedGlobalMarketEstimate.forecastValueUsdBn.toFixed(2)}B`,
    forecastLabel: "Publisher forecast",
    cagr: `${selectedGlobalMarketEstimate.cagr}% CAGR`,
    source: selectedGlobalMarketEstimate.source,
    sourceTitle: selectedGlobalMarketEstimate.reportTitle,
    sourceUrl: selectedGlobalMarketEstimate.url,
    reviewedAt: vorioMarketResearchReviewedAt,
    scopeNote: "Broader field-service-management context; not VORIO revenue, market share or a guarantee of demand.",
  },
] as const;

export function marketContextForProductHref(href: string) {
  const match = href.match(/\/products\/(vidyaluma|recruitflow|yukta|vorio)$/);
  return match ? portfolioMarketContexts.find((context) => context.productSlug === match[1]) : undefined;
}
