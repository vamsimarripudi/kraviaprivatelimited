import { test, expect } from "@playwright/test";

/**
 * Black-box security checks run against the development Office server with no
 * real session or employee credentials. They must not create HR documents,
 * employee IDs or messages. Real protected workflow verification needs
 * separately approved authenticated test identities after release.
 */
test("anonymous visitors cannot read private employee intake or photos", async ({ request }) => {
  for (const url of ["/api/office-employee-intake", "/api/office-employee-intake?directory=1", "/api/office-employee-intake/photo"]) {
    const response = await request.get(url);
    expect([401,403], url).toContain(response.status());
    expect(response.headers()["cache-control"], url).toContain("no-store");
    const body = await response.text();
    expect(body, url).not.toContain("bank_account_ciphertext");
    expect(body, url).not.toContain("office_employee_reference_ids");
  }
});

test("cross-origin requests cannot mutate employee intake or submit documents", async ({ request }) => {
  const maliciousOrigin = { Origin:"https://untrusted.example.invalid" };
  const mutation = await request.post("/api/office-employee-intake", {
    headers:maliciousOrigin,
    data:{action:"SUBMIT"},
  });
  expect(mutation.status()).toBe(403);
  expect(mutation.headers()["cache-control"]).toContain("no-store");
  const upload = await request.post("/api/office-employee-intake/upload", {
    headers:maliciousOrigin,
    multipart:{kind:"PHOTO", file:{name:"test.png",mimeType:"image/png",buffer:Buffer.from("not-a-photo")}},
  });
  expect(upload.status()).toBe(403);
  expect(upload.headers()["cache-control"]).toContain("no-store");
});

test("anonymous visitors cannot access private employee salary slips", async ({ request }) => {
  const url = "/api/office-salary-slips/00000000-0000-4000-8000-000000000001/pdf";
  const response = await request.get(url);
  // Without the corporate database in local browser CI, the protected route
  // correctly fails closed with 503 rather than forging an authentication result.
  expect([401,403,404,503], "salary download must not expose private data").toContain(response.status());
  expect(response.status()).not.toBe(200);
});

test("anonymous browsers cannot inspect or enable corporate lifecycle mail", async ({ request }) => {
  const read = await request.get("/api/office-lifecycle-mail-policy");
  expect([401,403,503]).toContain(read.status());
  expect(read.status()).not.toBe(200);
  expect(read.headers()["cache-control"]).toContain("no-store");

  const attack = await request.post("/api/office-lifecycle-mail-policy", {
    headers:{Origin:"https://untrusted.example.invalid"},
    data:{event_code:"ONB-05",enabled:true,reason:"Untrusted source cannot approve"},
  });
  expect(attack.status()).toBe(403);
  expect(attack.headers()["cache-control"]).toContain("no-store");
});
