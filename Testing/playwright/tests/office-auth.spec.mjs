import { test, expect } from "@playwright/test";

const account = "qa@kraviaprivatelimited.com";
const password = "Strong-Test1!";
function authPayload(overrides = {}) {
  return {
    authenticated: true,
    email: account,
    roles: ["MEMBER"],
    access_status: "ACTIVE",
    aal: "aal1",
    next_aal: "aal2",
    founder: false,
    display_role: "MEMBER",
    mfa: { enrolled: true, factor_ids: ["totp"] },
    ...overrides,
  };
}

const passwordInput = (page) => page.getByPlaceholder("Enter your password");

async function mockSignIn(page, payload, status = 200) {
  await page.route("**/api/office-auth/sign-in", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(payload),
    });
  });
}

async function mockMfa(page, handler) {
  await page.route("**/api/office-auth/mfa", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const response = await handler(body);
    await route.fulfill({
      status: response.status ?? 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(response.body ?? {}),
    });
  });
}

test("renders the configured private Office sign-in boundary", async ({ page }) => {
  await page.goto("/office/login");
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();
  await expect(page.getByLabel("Corporate email")).toBeEnabled();
  await expect(passwordInput(page)).toBeEnabled();
  await expect(page.getByText("Internal identity service is not active on this deployment.")).toHaveCount(0);
  await expect(page.getByText(/Only enter a password you created for KRAVIA Office/)).toBeVisible();
});

test("keeps an invalid password at the first factor", async ({ page }) => {
  await mockSignIn(page, { detail: "Corporate email or password was not accepted" }, 401);
  await page.goto("/office/login");
  await page.getByLabel("Corporate email").fill(account);
  await passwordInput(page).fill("Wrong-Pass1!");
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();
  await expect(page.getByRole("status")).toContainText("Corporate email or password was not accepted");
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();
});

test("first activation directs the user to an approved phone without exposing QR or setup-key enrollment", async ({ page }) => {
  await mockSignIn(page, authPayload({ mfa: { enrolled: false, factor_ids: [] } }));

  await page.goto("/office/login");
  await page.getByLabel("Corporate email").fill(account);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();

  await expect(page.getByRole("heading", { name: "Activate your phone" })).toBeVisible();
  await expect(page.getByText(/never shows a QR code or setup key in the browser/i)).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0);
  await expect(page.getByLabel("Authenticator code")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Authenticator instructions" })).toHaveAttribute("href", "/office/authenticator");

  await page.getByRole("button", { name: "Return to sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();
});

test("existing enrollment accepts six digits only and surfaces a rejected code", async ({ page }) => {
  await mockSignIn(page, authPayload());
  await mockMfa(page, async (body) => {
    expect(body.action).toBe("verify");
    return { status: 400, body: { detail: "The authenticator code was not accepted" } };
  });

  await page.goto("/office/login");
  await page.getByLabel("Corporate email").fill(account);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();

  await expect(page.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  const code = page.getByLabel("Authenticator code");
  await code.fill("12ab345678");
  await expect(code).toHaveValue("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("status")).toContainText("The authenticator code was not accepted");
});

test("successful MFA continues to the requested Office destination", async ({ page }) => {
  await mockSignIn(page, authPayload());
  await mockMfa(page, async (body) => {
    expect(body).toEqual({ action: "verify", code: "123456" });
    return { body: { verified: true, aal: "aal2" } };
  });

  await page.goto("/office/login?next=/office/e2e-complete");
  await page.getByLabel("Corporate email").fill(account);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();
  await page.getByLabel("Authenticator code").fill("123456");

  await page.route((url) => url.pathname === "/office/e2e-complete", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<main><h1>AAL2 destination reached</h1></main>" }),
  );
  await page.getByRole("button", { name: "Verify and continue" }).click();

  await expect(page).toHaveURL(/\/office\/e2e-complete$/);
  await expect(page.getByRole("heading", { name: "AAL2 destination reached" })).toBeVisible();
});

test("Office auth failures are same-origin protected and non-cacheable", async ({ request }) => {
  const crossOriginSignIn = await request.post("/api/office-auth/sign-in", {
    headers: { Origin: "https://evil.example" },
    data: { email: account, password },
  });
  expect(crossOriginSignIn.status()).toBe(403);
  expect(crossOriginSignIn.headers()["cache-control"]).toContain("no-store");

  const crossOriginMfa = await request.post("/api/office-auth/mfa", {
    headers: { Origin: "https://evil.example" },
    data: { action: "verify", code: "123456" },
  });
  expect(crossOriginMfa.status()).toBe(403);
  expect(crossOriginMfa.headers()["cache-control"]).toContain("no-store");

  const session = await request.get("/api/office-auth/session");
  expect(session.status()).toBe(401);
  expect(session.headers()["cache-control"]).toContain("no-store");
});

test("explicit MFA-required reason is visible and cannot silently open the workspace", async ({ page }) => {
  await page.goto("/office/login?reason=mfa_required&next=/office/dashboard");
  await expect(page.getByText("Complete multi-factor verification before opening this workspace.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to KRAVIA Office" })).toBeVisible();
});
