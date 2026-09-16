import { describe, expect, it } from "vitest";
import { createSupportReference, createTrackingCode, hashTrackingCode, supportQueueLabels, supportQueues } from "../lib/corporate/support";

describe("support case security primitives", () => {
  it("creates non-guessable case references and tracking codes with documented formats", () => {
    expect(createSupportReference()).toMatch(/^KRV-SUP-[A-Z0-9]{8}$/);
    expect(createTrackingCode()).toMatch(/^[A-Z0-9]{12}$/);
  });

  it("defines discrete queues for general, Trust/DPDP and security handling", () => {
    expect(supportQueues).toEqual(["GENERAL", "TRUST_DPDPA", "SECURITY_REPORTING"]);
    expect(supportQueueLabels.TRUST_DPDPA).toBe("Trust & DPDP");
  });

  it("stores only a stable SHA-256 representation of the tracking code", async () => {
    await expect(hashTrackingCode("ABC123DEF456")).resolves.toMatch(/^[a-f0-9]{64}$/);
    expect(await hashTrackingCode("ABC123DEF456")).not.toBe("ABC123DEF456");
  });
});