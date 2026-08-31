import { describe, expect, it } from "vitest";
import { publicProducts } from "../lib/corporate-content";
import { yuktaProduct } from "../lib/products/yukta";

describe("YUKTA public product record", () => {
  it("is a public Kravia product with a dedicated route and an honest availability state", () => {
    expect(publicProducts).toContainEqual(yuktaProduct);
    expect(yuktaProduct.href).toBe("/products/yukta");
    expect(yuktaProduct.status).toBe("COMING_SOON");
  });

  it("keeps the public product scope within governed healthcare operations", () => {
    expect(yuktaProduct.description).toContain("patient journeys");
    expect(yuktaProduct.faqs.find(([question]) => question === "Is YUKTA an AI doctor?")?.[1]).toContain("not presented as an AI doctor");
    expect(yuktaProduct.faqs.find(([question]) => question === "Does YUKTA replace clinical judgement?")?.[1]).toContain("retain clinical decision authority");
  });

  it("provides an existing corporate enquiry category for early-access routing", () => {
    expect(yuktaProduct.enquiryCategory).toContain("YUKTA");
    expect(yuktaProduct.enquiryCategory).toContain("early access");
  });
});