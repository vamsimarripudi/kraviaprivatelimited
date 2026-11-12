import { test, expect } from "@playwright/test";

const store = "https://play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator";
const badge = "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png";

test("office authenticator installation uses the official Google Play badge and verified app URL", async ({ page }) => {
  await page.goto("/office/authenticator");
  await expect(page.getByRole("heading", { name: "Activate your phone" })).toBeVisible();
  const download = page.getByRole("link", { name: /Get KRAVIA Authenticator on Google Play/ });
  await expect(download).toHaveAttribute("href", store);
  await expect(download).toHaveAttribute("target", "_blank");
  await expect(download.getByAltText("Get it on Google Play")).toHaveAttribute("src", badge);
  await expect(page.getByText(/Do not install APKs from messages or third-party websites/)).toBeVisible();
});
