import { test, expect } from "@playwright/test";

/*
 * This suite runs only against a local Next.js test server, with no corporate
 * identity, live provider, employment record, or outgoing email.
 * Authentic signing and leaver operations must never be executable publicly.
 */
const employee = "00000000-0000-4000-8000-000000000001";
const delivery = "00000000-0000-4000-8000-000000000002";
const validReview = {
  action: "REVIEW_SIGNING_ISSUANCE",
  delivery_event_id: delivery,
  approved: true,
  evidence_reference: "synthetic-ci-provider-proof",
  reason: "Synthetic local review must be rejected without Office login",
};

test("unauthenticated visitors cannot retrieve signing documents or Owner reviews", async ({ request }) => {
  for (const url of [
    "/api/office-documents",
    `/api/office-documents?download=${delivery}`,
    `/api/office-documents?signed=${delivery}`,
    `/api/office-exit-governance?employee_user_id=${employee}`,
  ]) {
    const result = await request.get(url);
    expect([401, 403, 404, 503], url).toContain(result.status());
    expect(result.status(), url).not.toBe(200);
    const body = await result.text();
    expect(body).not.toContain("signed_storage_reference");
    expect(body).not.toContain("office_exit_contact_evidence");
  }
});

test("cross-site scripts cannot approve, revoke or issue HR signing evidence", async ({ request }) => {
  const headers = { Origin: "https://untrusted.example.invalid" };
  for (const body of [
    validReview,
    { action: "REVOKE_SIGNING_ISSUANCE", delivery_event_id: delivery,
      reason: "Cross-site rejection of the trusted review process" },
    { action: "RECORD_DELIVERY", instance_id: employee, render_id: delivery,
      channel: "ESIGN", provider_reference: "invented-provider-code",
      event_type: "SIGNING_LINK_ISSUED", metadata: {} },
  ]) {
    const response = await request.post("/api/office-documents", { headers, data: body });
    expect(response.status(), body.action).toBe(403);
  }
  const exit = await request.post("/api/office-exit-governance", {
    headers,
    data: {
      action: "REVIEW_CONTACT", employee_user_id: employee,
      approve: true, reason: "Untrusted browser has no corporate authority",
    },
  });
  expect(exit.status()).toBe(403);
});

test("an unauthenticated same-site caller cannot attest or revoke a provider request", async ({ request }) => {
  for (const body of [
    validReview,
    { action: "REVOKE_SIGNING_ISSUANCE", delivery_event_id: delivery,
      reason: "Synthetic test of missing corporate authentication" },
  ]) {
    const response = await request.post("/api/office-documents", { data: body });
    expect([401, 403, 503], body.action).toContain(response.status());
    expect(response.status()).not.toBe(200);
  }
});
