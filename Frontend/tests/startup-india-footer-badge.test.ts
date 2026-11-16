import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const footer = read("components/footer.tsx");
const styles = read("components/footer.module.css");
const registrations = read("lib/corporate/public-registrations.ts");
const approvedIdentity = read("lib/corporate-content.ts");

describe("KRAVIA Startup India footer deduplication", () => {
  it("renders the verified Startup India and Udyam registrations once from the public registry", () => {
    expect(footer).toContain("getPublicCorporateRegistrations()");
    expect(footer).toContain("{recognitions.map((recognition) => (");
    expect(footer).toContain("<strong>{recognition.authority}</strong>");
    expect(footer).toContain("<code>{recognition.reference}</code>");
    expect(registrations).toContain('authority: "Startup India"');
    expect(approvedIdentity).toContain('recognitionNumber: "DIPP281524"');
    expect(approvedIdentity).toContain('statusLabel: "DPIIT Recognised Startup"');
  });

  it("removes only the duplicate Startup India badge from the separate membership column", () => {
    expect(footer).not.toContain("startupIndiaRecognition");
    expect(footer).not.toContain("styles.startupIndiaBadge");
    expect(footer).not.toContain("styles.programBadgeRow");
    expect(styles).not.toContain(".startupIndiaBadge");
    expect(styles).not.toContain(".programBadgeRow");
    expect(footer).toContain("Program membership");
    expect(footer).not.toMatch(/src="[^"]*(startup-india|startupindia|dpiit)[^"]*"/i);
  });

  it("preserves NVIDIA artwork, original membership wording and non-endorsement", () => {
    expect(footer).toContain('className={styles.inceptionBadge}');
    expect(footer).toContain('src="/brand/partners/nvidia-inception-member-rgb.svg"');
    expect(footer).toContain("KRAVIA PRIVATE LIMITED is a member of NVIDIA Inception.");
    expect(footer).toContain("They do not endorse KRAVIA products or services.");
    expect(footer).toContain('rel="noopener noreferrer"');
    expect(styles).toContain(".inceptionBadge img");
  });
});
