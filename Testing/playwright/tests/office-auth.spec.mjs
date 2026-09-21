import { test, expect } from "@playwright/test";

const account = "qa@kraviaprivatelimited.com";
const password = "Strong-Test1!";
const manualKey = "JBSWY3DPEHPK3PXP";
const qr = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nNwAAAAASUVORK5CYII=";

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
  await expect(page.getByLabel("Password")).toBeEnabled();
  await expect(page.getByText("Internal identity service is not active on this deployment.")).toHaveCount(0);
  await expect(page.getByText(/Only enter a password you created for KRAVIA Office/)).toBeVisible();
});

test("keeps an invalid password at the first factor", async ({ page }) => {
  await mockSignIn(page, { detail: "Corporate email or password was not accepted" }, 401);
  await page.goto("/office/login");
  await page.getByLabel("Corporate email").fill(account);
  await page.getByLabel("Password").fill("Wrong-Pass1!");
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();
  await expect(page.getByRole("status")).toContainText("Corporate email or password was not accepted");
  await expect(page.getByRole("heading", { name: "Sign in to KRAVIA Office" })).toBeVisible();
});

test("first enrollment hides the setup key until explicitly requested and does not persist it in web storage", async ({ page }) => {
  await mockSignIn(page, authPayload({ mfa: { enrolled: false, factor_ids: [] } }));
  await mockMfa(page, async (body) => {
    expect(body).toEqual({ action: "enroll" });
    return {
      body: {
        factor_id: "totp",
        qr_code: qr,
        manual_key: manualKey,
        friendly_name: "KRAVIA Authenticator",
        required_for_all_roles: true,
      },
    };
  });

  await page.goto("/office/login");
  await page.getByLabel("Corporate email").fill(account);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();

  await expect(page.getByRole("heading", { name: "Secure your account" })).toBeVisible();
  await expect(page.getByAltText("KRAVIA Office authenticator QR code")).toBeVisible();
  await expect(page.getByText(manualKey)).toHaveCount(0);
  await page.getByRole("button", { name: "Can’t scan the QR? Show setup key" }).click();
  await expect(page.getByText(manualKey)).toBeVisible();
  expect(page.url()).not.toContain(manualKey);

  const persisted = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(persisted.local).not.toContain(manualKey);
  expect(persisted.session).not.toContain(manualKey);
});

test("existing enrollment accepts six digits only and surfaces a rejected code", async ({ page }) => {
  await mockSignIn(page, authPayload());
  await mockMfa(page, async (body) => {
    expect(body.action).toBe("verify");
    return { status: 400, body: { detail: "The authenticator code was not accepted" } };
  });

  await page.goto("/office/login");
  await page.getByLabel("Corporate email").fill(account);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();

  await expect(page.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  const code = page.getByLabel("KRAVIA Authenticator code");
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
  await page.route("**/office/e2e-complete", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<main><h1>AAL2 destination reached</h1></main>" }),
  );

  await page.goto("/office/login?next=/office/e2e-complete");
  await page.getByLabel("Corporate email").fill(account);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in to KRAVIA Office" }).click();
  await page.getByLabel("KRAVIA Authenticator code").fill("123456");
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
