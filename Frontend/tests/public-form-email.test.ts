import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/office", () => ({ getOfficeRuntimeOrigin: () => "https://office.example.test" }));

import { requestPublicFormFollowUp, requestPublicFormReceipt } from "../lib/corporate/public-form-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public-form acknowledgement handoff", () => {
  it("uses a signed server-to-server request without returning the shared secret", async () => {
    vi.stubEnv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", "test-public-intake-webhook-secret-at-least-32-characters");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ delivery: "sent" }), { status: 201 }));
    vi.stubGlobal("fetch", fetcher);

    await expect(requestPublicFormReceipt({
      eventId: "public-contact:KRV-ABCDEF0123456789ABCDEF01",
      formKind: "CONTACT",
      reference: "KRV-ABCDEF0123456789ABCDEF01",
      recipientEmail: "recipient@example.test",
      recipientName: "Synthetic Recipient",
    })).resolves.toBe("sent");

    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://office.example.test/api/v1/public-intake/email-acknowledgements");
    expect(options.headers).toMatchObject({
      "x-kravia-intake-signature": expect.stringMatching(/^v1=[a-f0-9]{64}$/),
      "x-kravia-intake-timestamp": expect.stringMatching(/^\d+$/),
    });
    expect(JSON.stringify(options.headers)).not.toContain("test-public-intake-webhook-secret");
  });

  it("does not pretend email delivery is configured when the shared secret is absent", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    await expect(requestPublicFormReceipt({
      eventId: "public-contact:KRV-ABCDEF0123456789ABCDEF01",
      formKind: "CONTACT",
      reference: "KRV-ABCDEF0123456789ABCDEF01",
      recipientEmail: "recipient@example.test",
      recipientName: "Synthetic Recipient",
    })).resolves.toBe("unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("signs Office follow-ups and keeps unknown delivery outcomes distinct", async () => {
    vi.stubEnv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", "test-public-intake-webhook-secret-at-least-32-characters");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Unknown" }), { status: 503, headers: { "x-kravia-delivery-status": "UNKNOWN" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(requestPublicFormFollowUp({
      eventId: "public-followup:KRV-ABCDEF0123456789ABCDEF01:00000000-0000-0000-0000-000000000001",
      formKind: "CONTACT",
      reference: "KRV-ABCDEF0123456789ABCDEF01",
      recipientEmail: "recipient@example.test",
      recipientName: "Synthetic Recipient",
      message: "Synthetic reviewed reply.",
    })).resolves.toBe("unknown");
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://office.example.test/api/v1/public-intake/email-follow-ups");
    expect(options.headers).toMatchObject({ "x-kravia-intake-signature": expect.stringMatching(/^v1=[a-f0-9]{64}$/) });
    expect(JSON.stringify(options.headers)).not.toContain("test-public-intake-webhook-secret");
  });
});
