import { test, expect } from "@playwright/test";

const passwordInput = (page) => page.getByPlaceholder("Enter your password");

test("Office sign-in remains usable without horizontal overflow on mobile", async ({ page }) => {
  await page.goto("/office/login");
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();
  await expect(page.getByLabel("Corporate email")).toBeVisible();
  await expect(passwordInput(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to KRAVIA Office" })).toBeVisible();

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport + 1);
});

test("Finance sign-in remains usable on mobile and keeps the AAL2 notice", async ({ page }) => {
  await page.goto("/finance/login");
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Finance" })).toBeVisible();
  await expect(page.getByText("AAL2 required")).toBeVisible();
  await expect(page.getByLabel("Corporate email")).toBeVisible();
  await expect(passwordInput(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to KRAVIA Finance" })).toBeVisible();
});
