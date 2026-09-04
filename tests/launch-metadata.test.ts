import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";

describe("launch metadata", () => {
  it("declares Kravia's browser-install metadata and approved brand icons", () => {
    const result = manifest();
    expect(result.name).toBe("Kravia Private Limited");
    expect(result.start_url).toBe("/");
    expect(result.theme_color).toBe("#183d32");
    expect(result.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icon.png" }),
      expect.objectContaining({ src: "/apple-icon.png" }),
    ]));
  });
});