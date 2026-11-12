import { test, expect } from "@playwright/test";

test("Office light and dark sign-in share the same high-contrast design on desktop and mobile", async ({ page }) => {
  await page.goto("/office/login");
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();

  await page.evaluate(() => window.localStorage.setItem("kravia.office.appearance", "dark"));
  await page.reload();
  await expect(page.locator(".kravia-office[data-office-theme='dark']")).toBeVisible();
  await expect.poll(async () => page.locator(".kravia-office-auth").evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  )).toBe("rgb(5, 6, 9)");
  const dark = await page.evaluate(() => {
    const el = document.querySelector(".kravia-office-auth");
    const input = document.querySelector("input");
    return {
      bg: getComputedStyle(el).backgroundColor,
      text: getComputedStyle(input).color,
      fieldBg: getComputedStyle(input).backgroundColor,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    };
  });
  expect(dark.bg).toBe("rgb(5, 6, 9)");
  expect(dark.text).toBe("rgb(247, 248, 251)");
  expect(dark.fieldBg).toBe("rgb(23, 26, 34)");
  expect(dark.scrollWidth).toBeLessThanOrEqual(dark.width + 1);

  await page.evaluate(() => window.localStorage.setItem("kravia.office.appearance", "light"));
  await page.reload();
  await expect(page.locator(".kravia-office[data-office-theme='light']")).toBeVisible();
  await expect.poll(async () => page.locator(".kravia-office-auth").evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  )).toBe("rgb(246, 247, 250)");
  const light = await page.evaluate(() => {
    const el = document.querySelector(".kravia-office-auth");
    const input = document.querySelector("input");
    return {
      bg: getComputedStyle(el).backgroundColor,
      text: getComputedStyle(input).color,
      fieldBg: getComputedStyle(input).backgroundColor,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    };
  });
  expect(light.bg).toBe("rgb(246, 247, 250)");
  expect(light.text).toBe("rgb(23, 27, 37)");
  expect(light.fieldBg).toBe("rgb(255, 255, 255)");
  expect(light.scrollWidth).toBeLessThanOrEqual(light.width + 1);
});
