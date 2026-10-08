import { describe, expect, it } from "vitest";
import {
  createLegalPrintProof,
  createLegalPrintReservation,
  legalPrintProofHash,
  signLegalPrintReservation,
  submitLegalPrintReservation,
  verifyLegalPrintReservation,
} from "../lib/legal/print-reservation";
import { consumeLegalPrintRateLimit, legalPrintRateLimitKey } from "../lib/legal/print-rate-limit";

describe("first-party legal print reservations", () => {
  const key = "a".repeat(43);

  it("signs a policy-bound reservation and rejects a modified token", () => {
    const proof = createLegalPrintProof();
    const reservation = createLegalPrintReservation({
      id: "4efab608-15ea-472f-ae82-0a2b944fbfca",
      documentPath: "/legal/privacy",
      documentVersion: "1",
      documentHash: "b".repeat(64),
      reference: "KRV-LGL-20261008-000001",
      issuedOn: "2026-10-08",
      attempts: 1,
    }, proof, new Date("2026-10-08T00:00:00.000Z"));
    const token = signLegalPrintReservation(reservation, key);
    expect(verifyLegalPrintReservation(token, key, reservation.expiresAt - 1)).toEqual(reservation);
    expect(verifyLegalPrintReservation(`${token}x`, key, reservation.expiresAt - 1)).toBeNull();
    expect(legalPrintProofHash(proof)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retains the server reference while recording a submitted print request precisely", () => {
    const reservation = createLegalPrintReservation({
      id: "3b70aec2-a1bb-4ebc-9014-268093a9b830",
      documentPath: "/legal/privacy",
      documentVersion: "1",
      documentHash: "c".repeat(64),
      reference: "KRV-LGL-20261008-000002",
      issuedOn: "2026-10-08",
      attempts: 2,
    }, createLegalPrintProof(), new Date("2026-10-08T00:00:00.000Z"));
    const submitted = submitLegalPrintReservation(reservation, new Date("2026-10-08T00:03:00.000Z"));
    expect(submitted.reference).toBe(reservation.reference);
    expect(submitted.attempts).toBe(2);
    expect(submitted.state).toBe("SUBMITTED");
    expect(submitted.expiresAt).toBeGreaterThan(reservation.expiresAt);
  });

  it("bounds repeated requests without retaining raw client identifiers", () => {
    const keyForTest = legalPrintRateLimitKey(`test-${Date.now()}`, "vitest");
    for (let index = 0; index < 12; index += 1) {
      expect(consumeLegalPrintRateLimit(keyForTest, 1_000)).toEqual({ allowed: true });
    }
    expect(consumeLegalPrintRateLimit(keyForTest, 1_000)).toEqual(expect.objectContaining({ allowed: false }));
  });
});
