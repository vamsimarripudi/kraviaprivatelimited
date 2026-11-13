import { test, expect } from "@playwright/test";

/*
 * This browser suite deliberately uses no real employee identity, OTP, e-mail
 * service or production data. It enforces the public/private route boundary
 * and checks the honest first-access information on desktop and mobile.
 */
test("first-access guide renders without login and does not leak employee manuals", async ({ page }) => {
  const response = await page.goto("/office/quick-start");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 2, name: "First access: six steps" })).toBeVisible();
  await expect(page.getByText("Confirm your private invitation")).toBeVisible();
  await expect(page.getByText("Read your assigned handbook")).toBeVisible();

  const authLink = page.getByRole("link", { name: /Install and activate Authenticator/ });
  await expect(authLink).toHaveAttribute("href", "/office/authenticator");
  const signInLink = page.getByRole("link", { name: /Sign in to KRAVIA Office/ });
  await expect(signInLink).toHaveAttribute("href", "/office/login");

  const text = await page.locator("main").allTextContents();
  expect(text.join(" ")).not.toContain("Full stack role package applied");
  expect(text.join(" ")).not.toContain("Employee bank account number");

  const viewport = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(viewport.document).toBeLessThanOrEqual(viewport.viewport + 2);
});

test("Info and Finance profile require an authorised Office session", async ({ page }) => {
  for (const route of ["/office/info", "/finance/info", "/finance/my-role"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/(office|finance)\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: /Sign in to KRAVIA/ })).toBeVisible();
  }
});

test("manual APIs fail closed without a session and prevent cross-site state changes", async ({ request }) => {
  const read = await request.get("/api/office-manual");
  expect([401, 403]).toContain(read.status());
  expect(read.headers()["cache-control"]).toContain("no-store");

  const download = await request.get("/api/office-manual/download");
  expect([401, 403]).toContain(download.status());
  expect(download.headers()["cache-control"]).toContain("no-store");
  expect(download.headers()["content-type"]).not.toContain("application/pdf");

  const write = await request.post("/api/office-manual", {
    data: { action: "ACKNOWLEDGE", key: "COMMON" },
    headers: { Origin: "https://attacker.example" },
  });
  expect(write.status()).toBe(403);
  expect(write.headers()["cache-control"]).toContain("no-store");
});
