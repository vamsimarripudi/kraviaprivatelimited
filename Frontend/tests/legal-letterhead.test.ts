import { describe, expect, it } from "vitest";

import { kraviaLetterheadContactLine, kraviaLetterheadProfile } from "../lib/legal/letterhead";

describe("KRAVIA legal letterhead profile", () => {
  it("contains every applicable Companies Act stationery field", () => {
    expect(kraviaLetterheadProfile.legalName).toBe("KRAVIA PRIVATE LIMITED");
    expect(kraviaLetterheadProfile.registeredOffice).toBeTruthy();
    expect(kraviaLetterheadProfile.cin).toBe("U62011AP2026PTC126691");
    expect(kraviaLetterheadProfile.telephone).toMatch(/^\+91\s\d{5}\s\d{5}$/);
    expect(kraviaLetterheadProfile.email).toBe("corporate@kraviaprivatelimited.com");
    expect(kraviaLetterheadProfile.website).toBe("www.kraviaprivatelimited.com");
  });

  it("prints one complete contact line without retired details", () => {
    expect(kraviaLetterheadContactLine).toContain("CIN: U62011AP2026PTC126691");
    expect(kraviaLetterheadContactLine).toContain("TEL: +91 70139 81759");
    expect(kraviaLetterheadContactLine).toContain("corporate@kraviaprivatelimited.com");
    expect(kraviaLetterheadContactLine).not.toContain("vmetron");
  });
});
