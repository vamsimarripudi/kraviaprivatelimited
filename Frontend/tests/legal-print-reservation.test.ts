import { describe, expect, it } from "vitest";
import {
  completeLegalPrintReservation,
  createLegalPrintReservation,
  retryLegalPrintReservation,
  signLegalPrintReservation,
  verifyLegalPrintReservation,
} from "../lib/legal/print-reservation";
import { consumeLegalPrintRateLimit, legalPrintRateLimitKey } from "../lib/legal/print-rate-limit";

describe("first-party legal print reservations", () => {
  const key = "a".repeat(43);

  it("signs a policy-bound reservation and rejects a modified token", () => {
    const reservation = createLegalPrintReservation({
      documentPath: "/legal/privacy",
      documentVersion: "1",
      documentHash: "b".repeat(64),
    }, new Date("2026-10-08T00:00:00.000Z"));
    const token = signLegalPrintReservation(reservation, key);
    expect(verifyLegalPrintReservation(token, key, reservation.expiresAt - 1)).toEqual(reservation);
    expect(verifyLegalPrintReservation(`${token}x`, key, reservation.expiresAt - 1)).toBeNull();
  });

  it("retains the same reference only for a bounded retry, then records local completion", () => {
    const reservation = createLegalPrintReservation({
      documentPath: "/legal/privacy",
      documentVersion: "1",
      documentHash: "c".repeat(64),
    }, new Date("2026-10-08T00:00:00.000Z"));
    const retry = retryLegalPrintReservation(reservation, new Date("2026-10-08T00:02:00.000Z"));
    const completed = completeLegalPrintReservation(retry, new Date("2026-10-08T00:03:00.000Z"));
    expect(retry.reference).toBe(reservation.reference);
    expect(retry.attempts).toBe(2);
    expect(completed.state).toBe("PRINTED");
    expect(completed.expiresAt).toBeGreaterThan(retry.expiresAt);
  });

  it("bounds repeated requests without retaining raw client identifiers", () => {
    const keyForTest = legalPrintRateLimitKey(`test-${Date.now()}`, "vitest");
    for (let index = 0; index < 12; index += 1) {
      expect(consumeLegalPrintRateLimit(keyForTest, 1_000)).toEqual({ allowed: true });
    }
    expect(consumeLegalPrintRateLimit(keyForTest, 1_000)).toEqual(expect.objectContaining({ allowed: false }));
  });
});
