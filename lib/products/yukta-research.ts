import { z } from "zod";

export const researchCheckedAt = "2026-09-06";
export const sourceSchema = z.object({
  id: z.string().min(1), publisher: z.string().min(1), title: z.string().min(1), url: z.url(),
  publishedAt: z.string().nullable(), updatedAt: z.string().nullable(), checkedAt: z.iso.date(),
  location: z.string().min(1), methodology: z.string().min(1), reuse: z.string().min(1),
});
export const yuktaSources = z.array(sourceSchema).parse([
  { id: "gvr-india", publisher: "Grand View Research", title: "India Practice Management System Market Outlook, 2030", url: "https://www.grandviewresearch.com/horizon/outlook/practice-management-system-market/india", publishedAt: "2024-07-01", updatedAt: "2025-12-02", checkedAt: researchCheckedAt, location: "Market highlights and data book summary", methodology: "Public summary; full proprietary methodology is not accessible. Includes software and services and integrated/standalone systems. Endpoint-implied growth differs from the stated CAGR; only endpoints are published here.", reuse: "Attributed summary facts only; no publisher charts or paywalled tables reproduced." },
  { id: "mordor-global", publisher: "Mordor Intelligence", title: "Practice Management System Market, 2026–2031", url: "https://www.mordorintelligence.com/industry-reports/practice-management-system-market", publishedAt: null, updatedAt: "2026-07-30", checkedAt: researchCheckedAt, location: "Market size and share; Market analysis", methodology: "Independent publisher using a proprietary estimation framework. Broader global category includes software/services and multiple healthcare settings. Not a like-for-like India estimate.", reuse: "Attributed summary facts; original charts, no copied report graphics." },
  { id: "nha-registration", publisher: "MoHFW / Press Information Bureau", title: "25 crore OPD registrations through ABHA-based Scan and Register", url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2295972&lang=1&reg=48", publishedAt: "2026-08-07", updatedAt: null, checkedAt: researchCheckedAt, location: "Opening milestone and participating facilities paragraphs", methodology: "Government administrative counts, not unique patients or potential software buyers. Public/private facility counts sum to 30,804; headline rounds to 30,800.", reuse: "Short attributed factual summary; no reproduced image." },
]);

export const metricSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), definition: z.string().min(1), value: z.number().finite().nonnegative(),
  unit: z.enum(["USD million", "facilities", "registrations"]), geography: z.string().min(1), period: z.string().min(1),
  kind: z.enum(["publisher_estimate", "publisher_forecast", "observed_statistic", "derived_calculation"]),
  forecastYear: z.number().int().optional(), sourceIds: z.array(z.string()).min(1), location: z.string().min(1),
  state: z.enum(["verified", "needs_review", "disputed", "withdrawn"]), visibility: z.enum(["public", "private"]),
  verifiedAt: z.iso.date(), nextReviewAt: z.iso.date(), limitations: z.string().min(1),
  derivation: z.object({ formula: z.string().min(1), inputIds: z.array(z.string()).min(1), version: z.literal(1) }).optional(),
}).superRefine((metric, ctx) => {
  if (metric.kind === "publisher_forecast" && !metric.forecastYear) ctx.addIssue({ code: "custom", message: "Forecast horizon required" });
  if (metric.kind === "derived_calculation" && !metric.derivation) ctx.addIssue({ code: "custom", message: "Calculation inputs required" });
});
export type ResearchMetric = z.infer<typeof metricSchema>;
const base = { state: "verified", visibility: "public", verifiedAt: researchCheckedAt, nextReviewAt: "2027-03-06" } as const;
const market = { unit: "USD million", definition: "Practice management systems revenue including software and services; not YUKTA addressable revenue", location: "Market size summary", limitations: "Publisher estimate, not audited actual revenue or a guarantee. Broader than YUKTA V1." } as const;
export const yuktaMetrics = z.array(metricSchema).parse([
  { ...base, ...market, id: "india-pms-2024", label: "India PMS · 2024 estimate", value: 522.3, geography: "India", period: "2024", kind: "publisher_estimate", sourceIds: ["gvr-india"] },
  { ...base, ...market, id: "india-pms-2030", label: "India PMS · 2030 forecast", value: 1049, geography: "India", period: "2030", forecastYear: 2030, kind: "publisher_forecast", sourceIds: ["gvr-india"] },
  { ...base, ...market, id: "global-pms-2026", label: "Global PMS · 2026 estimate", value: 13810, geography: "Global", period: "2026", kind: "publisher_estimate", sourceIds: ["mordor-global"] },
  { ...base, ...market, id: "global-pms-2031", label: "Global PMS · 2031 forecast", value: 20750, geography: "Global", period: "2031", forecastYear: 2031, kind: "publisher_forecast", sourceIds: ["mordor-global"] },
  ...[{ id: "scan-public", label: "Public facilities", value: 24323 }, { id: "scan-private", label: "Private facilities", value: 6481 }].map(row => ({ ...base, ...row, unit: "facilities" as const, definition: "Facilities using ABHA Scan and Register, as reported by MoHFW", geography: "India", period: "2026-08-07", kind: "observed_statistic" as const, sourceIds: ["nha-registration"], location: "Participating facilities paragraph", limitations: "Administrative snapshot, not total hospitals, paying software customers or YUKTA adoption." })),
]);

export function validateResearchRegistry(metrics: ResearchMetric[], sources = yuktaSources) {
  const sourceIds = new Set(sources.map(source => source.id));
  const ids = new Set(metrics.map(metric => metric.id));
  if (ids.size !== metrics.length) throw new Error("Duplicate metric ID");
  for (const metric of metrics) {
    metricSchema.parse(metric);
    if (metric.sourceIds.some(id => !sourceIds.has(id))) throw new Error(`Unknown source for ${metric.id}`);
    if (metric.derivation?.inputIds.some(id => !ids.has(id) || id === metric.id)) throw new Error(`Invalid derivation for ${metric.id}`);
  }
  return metrics;
}
validateResearchRegistry(yuktaMetrics);
export function publicResearchMetrics(asOf: string = researchCheckedAt) {
  return yuktaMetrics.filter(metric => metric.visibility === "public" && metric.state === "verified" && metric.nextReviewAt >= asOf);
}
export function calculatedCagr(baseValue: number, forecastValue: number, baseYear: number, forecastYear: number) {
  if (![baseValue, forecastValue, baseYear, forecastYear].every(Number.isFinite) || baseValue <= 0 || forecastValue <= 0 || forecastYear <= baseYear) throw new Error("Invalid forecast inputs");
  return (Math.pow(forecastValue / baseValue, 1 / (forecastYear - baseYear)) - 1) * 100;
}
export const formatResearchValue = (metric: ResearchMetric) => metric.unit === "USD million" ? `$${metric.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : metric.value.toLocaleString("en-US");

export const yuktaBuyerFaqs = [
  ["Is YUKTA available today?", "YUKTA is in development. This page describes documented V1 design, not a general-availability release or a confirmed pilot. Contact Kravia to discuss product fit and current readiness."],
  ["Is YUKTA a complete hospital ERP?", "No. V1 is designed for small clinics and outpatient hospitals. Inpatient admissions, beds, wards, operating theatres, nursing management and large-hospital ERP functions are outside its V1 scope."],
  ["Does a doctor have to enter every prescription digitally?", "No. The documented V1 workflow supports a printed OP consultation sheet and handwritten clinical notes. Authorised staff coordinate downstream administrative work from doctor instructions."],
  ["Which web and mobile experiences are planned?", "The design separates facility supervision on Hospital Web, daily work in YUKTA Clinic, and patient-facing appointments and status in YUKTA Patient. Store availability and supported device releases will be confirmed with release evidence."],
  ["How are appointments and queues connected?", "Both are designed around the doctor timeline: schedule, arrivals, current consultation, breaks and delays. Wait times are estimates, not promises, and staff retain operational control."],
  ["Are insurance and NHCX claims included?", "No. Insurance, TPA and NHCX claims are excluded from the documented V1 scope."],
  ["Is ABDM or ABHA connectivity live?", "Production connectivity has not been verified for this page. ABDM/FHIR interoperability is future architecture direction, not an available V1 integration or a certification claim."],
  ["Which languages are supported?", "English and Telugu are required by the V1 design. That requirement does not establish that a released bilingual build has passed device and language QA."],
  ["Can YUKTA operate offline?", "The design requires explicit offline and reconnect handling. A fully offline service is not promised. Online payment confirmation and live synchronisation depend on the relevant connected services."],
  ["Can a clinic import existing records?", "Discuss the source format and migration scope with Kravia. No universal import, automatic migration or completion time is promised; record mapping and validation must be agreed before onboarding."],
  ["What are the pricing and onboarding terms?", "Public prices, implementation dates and support hours have not been confirmed here. Kravia can discuss workflow fit, staff roles, schedules, printing and facility pricing configuration before any activation."],
  ["Can users export data or request changes?", "The design includes authorised financial exports and governed data-request handling. Export scope, retention and account-change procedures must be confirmed in the applicable release and agreements."],
  ["What do the market charts represent?", "They show attributed practice-management-system estimates and forecasts, plus a separate Indian digital-registration infrastructure snapshot. They do not measure YUKTA revenue, adoption, valuation or clinical effectiveness."],
  ["Has YUKTA measured operational improvements?", "No pilot outcome dataset has been verified for this page. Registration time, waiting time, follow-up completion and reconciliation are proposed measurement areas, not published product results."],
] as const;
