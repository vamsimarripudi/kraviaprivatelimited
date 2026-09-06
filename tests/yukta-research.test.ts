import { describe, expect, it } from "vitest";
import { calculatedCagr, metricSchema, publicResearchMetrics, validateResearchRegistry, yuktaMetrics, yuktaSources } from "../lib/products/yukta-research";
import { enquiryInput, enquiryReference } from "../lib/enquiry-intake";

describe("reviewed YUKTA research", () => {
  it("has attributable public metrics and a current review window", () => {
    expect(validateResearchRegistry(yuktaMetrics)).toHaveLength(6);
    expect(publicResearchMetrics(new Date().toISOString().slice(0, 10))).toHaveLength(6);
    expect(yuktaSources.every(source => source.url.startsWith("https://"))).toBe(true);
  });
  it("rejects unknown values and unsupported forecasts", () => {
    expect(metricSchema.safeParse({ ...yuktaMetrics[0], value: null }).success).toBe(false);
    expect(metricSchema.safeParse({ ...yuktaMetrics[1], forecastYear: undefined }).success).toBe(false);
    expect(metricSchema.safeParse({ ...yuktaMetrics[0], kind: "derived_calculation" }).success).toBe(false);
    expect(() => validateResearchRegistry([{ ...yuktaMetrics[0], sourceIds: ["missing"] }])).toThrow();
    expect(() => validateResearchRegistry([yuktaMetrics[0], yuktaMetrics[0]])).toThrow();
    expect(publicResearchMetrics("2027-03-07")).toEqual([]);
  });
  it("retains source endpoints without manufacturing annual points", () => {
    expect(yuktaMetrics.filter(metric => metric.unit === "USD million").map(metric => metric.value)).toEqual([522.3, 1049, 13810, 20750]);
    expect(calculatedCagr(13810, 20750, 2026, 2031)).toBeCloseTo(8.48, 1);
    expect(Math.abs(calculatedCagr(522.3, 1049, 2024, 2030) - 12.6)).toBeGreaterThan(.2);
    expect(() => calculatedCagr(0, 100, 2024, 2030)).toThrow();
    expect(() => calculatedCagr(100, 200, 2030, 2024)).toThrow();
    expect(yuktaMetrics.filter(metric => metric.unit === "facilities").reduce((sum, metric) => sum + metric.value, 0)).toBe(30804);
  });
});

describe("enquiry retry identity", () => {
  const input = { requestId: "9a0f3ecd-5a15-4cb0-91e6-16c3061c5958", name: "Synthetic Tester", email: "test@example.com", category: "Product enquiry", message: "Synthetic workflow test only", privacyAcknowledged: "true" as const };
  it("returns the same identity for a retry but not changed content", () => {
    expect(enquiryReference(input)).toBe(enquiryReference(input));
    expect(enquiryReference(input)).not.toBe(enquiryReference({ ...input, message: "Changed synthetic enquiry" }));
    expect(enquiryInput.safeParse({ ...input, email: "invalid" }).success).toBe(false);
  });
});
