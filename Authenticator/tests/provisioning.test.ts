import { describe, expect, it } from "vitest";
import { manualKraviaAccount, parseKraviaProvisioningUri } from "../src/provisioning";

describe("KRAVIA provisioning", () => {
  it("accepts the standard KRAVIA Office TOTP URI", () => {
    const account = parseKraviaProvisioningUri(
      "otpauth://totp/KRAVIA%20Office%3Avamsi%40kraviaprivatelimited.com?secret=JBSWY3DPEHPK3PXP&issuer=KRAVIA%20Office&algorithm=SHA1&digits=6&period=30",
    );
    expect(account.issuer).toBe("KRAVIA Office");
    expect(account.account).toBe("vamsi@kraviaprivatelimited.com");
    expect(account.secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("rejects QR codes from other issuers", () => {
    expect(() => parseKraviaProvisioningUri(
      "otpauth://totp/Other%3Auser%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Other",
    )).toThrow("not issued by KRAVIA");
  });

  it("rejects non-standard parameters", () => {
    expect(() => parseKraviaProvisioningUri(
      "otpauth://totp/KRAVIA%20Office%3Auser%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=KRAVIA%20Office&digits=8",
    )).toThrow("Unsupported");
  });

  it("supports the Office manual setup-key fallback", () => {
    const account = manualKraviaAccount("User@KraviaPrivateLimited.com", "JBSW Y3DP EHPK 3PXP");
    expect(account.account).toBe("user@kraviaprivatelimited.com");
    expect(account.secret).toBe("JBSWY3DPEHPK3PXP");
  });
});
