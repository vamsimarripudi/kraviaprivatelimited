import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicProducts } from "../lib/corporate-content";
import { recruitFlowProduct } from "../lib/products/recruitflow";
import { recruitFlowMarketEstimates, selectedRecruitFlowIndiaEstimate } from "../lib/products/recruitflow-market";

const page = readFileSync(new URL("../components/recruitflow-product-page.tsx", import.meta.url), "utf8");
const canonicalRoute = readFileSync(new URL("../app/products/nicerole/page.tsx", import.meta.url), "utf8");
const legacyRoute = readFileSync(new URL("../app/products/recruitflow/page.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../components/footer.tsx", import.meta.url), "utf8");

describe("Nice Role public product profile", () => {
  it("is registered as a public Kravia beta product with the approved external application destination", () => {
    expect(publicProducts).toContainEqual(recruitFlowProduct);
    expect(recruitFlowProduct.name).toBe("Nice Role");
    expect(recruitFlowProduct.slug).toBe("nicerole");
    expect(recruitFlowProduct.href).toBe("/products/nicerole");
    expect(recruitFlowProduct.website).toBe("https://nicerole.vmnexa.co.in");
    expect(recruitFlowProduct.status).toBe("BETA");
  });

  it("uses Nice Role across the public product page, canonical route and footer", () => {
    expect(page).toContain("Nice Role");
    expect(page).not.toContain("RecruitFlow");
    expect(canonicalRoute).toContain('canonical: "/products/nicerole"');
    expect(canonicalRoute).toContain('ProductJsonLd slug="nicerole"');
    expect(legacyRoute).toContain('permanentRedirect("/products/nicerole")');
    expect(footer).toContain('["Nice Role", "/products/nicerole"]');
  });

  it("keeps consequential hiring decisions human-controlled", () => {
    const copy = JSON.stringify(recruitFlowProduct).toLowerCase();
    expect(copy).toContain("does not independently hire, reject or disqualify");
    expect(copy).toContain("human-controlled");
    expect(page).toContain("Hiring authority stays human");
  });

  it("uses exact published market endpoints with source URLs", () => {
    expect(recruitFlowMarketEstimates).toHaveLength(3);
    expect(recruitFlowMarketEstimates[0]).toMatchObject({ baseYear: 2025, baseValue: 3.28, forecastYear: 2030, forecastValue: 4.88, cagr: 8.2 });
    expect(selectedRecruitFlowIndiaEstimate).toMatchObject({ baseYear: 2025, baseValue: 81.6, forecastYear: 2034, forecastValue: 122.9, cagr: 4.52 });
    expect(recruitFlowMarketEstimates[2]).toMatchObject({ baseYear: 2026, baseValue: 17.48, forecastYear: 2034, forecastValue: 46.07, cagr: 12.9 });
    expect(recruitFlowMarketEstimates.every((estimate) => estimate.url.startsWith("https://"))).toBe(true);
  });

  it("does not present published market research as Nice Role performance", () => {
    expect(page).toContain("not Nice Role revenue, valuation, market share, customer count or guaranteed demand");
    expect(page).toContain("no intermediate annual values are invented");
  });
});
