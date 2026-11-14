import { test, expect } from "@playwright/test";

// Local-only tests. No corporate session, email provider, geo request or approval.
const item = "00000000-0000-4000-8000-000000000001";
const render = "00000000-0000-4000-8000-000000000002";

test("anonymous users cannot list an assigned employee's OTP documents", async ({request}) => {
  const response = await request.get("/api/office-documents/otp");
  expect([401,403,503]).toContain(response.status());
  expect(response.status()).not.toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("cross-site callers cannot initiate or approve a document OTP", async ({request}) => {
  const malicious = { Origin: "https://untrusted.example.invalid" };
  const inputs = [
    {action:"REQUEST",instance_id:item,render_id:render},
    {action:"VERIFY",instance_id:item,render_id:render,challenge_id:item,
      code:"123456",location:{latitude:17.385,longitude:78.486,accuracy_m:20,
      captured_at:"2026-11-14T00:00:00Z"}},
  ];
  for (const input of inputs) {
    const response = await request.post("/api/office-documents/otp",{
      headers:malicious,data:input,
    });
    expect(response.status(),input.action).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("anonymous same-origin requests cannot dispatch or confirm email OTP", async ({request}) => {
  const response = await request.post("/api/office-documents/otp",{
    data:{action:"REQUEST",instance_id:item,render_id:render},
  });
  expect([401,403,503]).toContain(response.status());
  expect(response.status()).not.toBe(201);
});
