import { describe, expect, it } from "vitest";
import { publicProducts } from "../lib/corporate-content";
import { vidyaLumaProduct } from "../lib/products/vidyaluma";

describe("VidyaLuma public product record", () => {
  it("is an official Kravia product with a corporate overview and canonical product destination", () => {
    expect(publicProducts).toContainEqual(vidyaLumaProduct);
    expect(vidyaLumaProduct.href).toBe("/products/vidyaluma");
    expect(vidyaLumaProduct.website).toBe("https://vidyaluma.in");
    expect(vidyaLumaProduct.public).toBe(true);
  });

  it("preserves the independent product identity and product-enquiry context", () => {
    expect(vidyaLumaProduct.name).toBe("VidyaLuma");
    expect(vidyaLumaProduct.enquiryCategory).toContain("VidyaLuma");
    expect(vidyaLumaProduct.enquiryCategory).toContain("School Intelligence & Operations Platform");
  });

  it("does not rely on fabricated commercial, performance, or certification claims", () => {
    const publicCopy = JSON.stringify(vidyaLumaProduct).toLowerCase();
    expect(publicCopy).not.toContain("trusted by");
    expect(publicCopy).not.toContain("certified");
    expect(publicCopy).not.toContain("#1");
    expect(publicCopy).not.toContain("100%");
  });
});