import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const link = "https://play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator";
const badge = "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png";

describe("Official KRAVIA Authenticator Google Play install links", () => {
  it("centralizes the approved Google Play app listing and unmodified badge", () => {
    const c = read("lib/office/authenticator-store.ts");
    expect(c).toContain(link);
    expect(c).toContain(badge);
  });
  it("uses the official badge on the Office activation page", () => {
    const p = read("app/office/authenticator/page.tsx");
    expect(p).toContain("GOOGLE_PLAY_BADGE_IMAGE_URL");
    expect(p).toContain("KRAVIA_AUTHENTICATOR_PLAY_STORE_URL");
    expect(p).toContain('alt="Get it on Google Play"');
    expect(p).toContain("Install the Android app");
  });
  it("provides the same app badge in the public KRAVIA footer", () => {
    const f = read("components/footer.tsx");
    expect(f).toContain("KRAVIA_AUTHENTICATOR_PLAY_STORE_URL");
    expect(f).toContain("GOOGLE_PLAY_BADGE_IMAGE_URL");
    expect(f).toContain('alt="Get it on Google Play"');
    expect(f).toContain("Official Android app");
  });
  it("does not send emails on rendering or deployment", () => {
    const page = read("app/office/authenticator/page.tsx");
    const footer = read("components/footer.tsx");
    const auth = read("../Backend/backend/identity_auth.py");
    expect(page).not.toContain("send_office_workspace_ready_email");
    expect(footer).not.toContain("send_office_workspace_ready_email");
    expect(auth).toContain("send_office_workspace_ready_email");
    expect(auth).toContain("WORKSPACE_ACTIVATED");
  });
});
