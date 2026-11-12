import { test, expect } from "@playwright/test";

const viewports = [
  { width: 320, height: 568 }, // narrow phone
  { width: 390, height: 844 }, // iPhone portrait
  { width: 430, height: 932 }, // large phone
  { width: 844, height: 390 }, // phone landscape
  { width: 768, height: 1024 }, // tablet portrait
  { width: 1024, height: 768 }, // tablet landscape / compact desktop
  { width: 1440, height: 900 }, // desktop
];

test("Office sign-in fills supported viewport sizes without clipping or horizontal overflow", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/office/login");
    await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();
    await expect(page.getByLabel("Corporate email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector("[data-office-auth-layout]");
      const side = shell?.querySelector("section:last-child");
      const card = side?.querySelector('[class*="card"]');
      const form = card?.querySelector("form");
      if (!shell || !side || !card || !form) return null;
      const rectangle = card.getBoundingClientRect();
      return {
        horizontalScroll: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        sideHeight: side.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
        cardHeight: rectangle.height,
        formWidth: form.getBoundingClientRect().width,
        cardWidth: rectangle.width,
        cardLeft: rectangle.left,
        cardRight: rectangle.right,
      };
    });

    expect(metrics, JSON.stringify(viewport)).not.toBeNull();
    expect(metrics.horizontalScroll, JSON.stringify(viewport)).toBeLessThanOrEqual(metrics.viewportWidth + 2);
    expect(metrics.sideHeight, JSON.stringify(viewport)).toBeGreaterThanOrEqual(metrics.viewportHeight - 4);
    expect(metrics.cardWidth, JSON.stringify(viewport)).toBeGreaterThan(250);
    expect(metrics.formWidth, JSON.stringify(viewport)).toBeGreaterThan(240);
    expect(metrics.cardLeft, JSON.stringify(viewport)).toBeGreaterThanOrEqual(-1);
    expect(metrics.cardRight, JSON.stringify(viewport)).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    if (viewport.width <= 980 && viewport.height >= 700) {
      expect(metrics.cardHeight, JSON.stringify(viewport)).toBeGreaterThan(viewport.height * .65);
    }
  }
});

test("official KRAVIA logo remains legible in mobile light and dark sign-in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/office/login");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((next) => localStorage.setItem("kravia.office.appearance", next), theme);
    await page.reload();
    await expect(page.locator('.kravia-office[data-office-theme="' + theme + '"]')).toBeVisible();

    const active = page.locator('[data-office-logo-variant="' + theme + '"] .brand-logo img');
    const inactive = page.locator('[data-office-logo-variant="' + (theme === "dark" ? "light" : "dark") + '"] .brand-logo img');
    await expect(active).toBeVisible();
    await expect(inactive).toBeHidden();
    const filter = await active.evaluate((img) => getComputedStyle(img).filter);
    if (theme === "dark") expect(filter).toContain("invert(1)");
    else expect(filter).toBe("none");
  }
});
