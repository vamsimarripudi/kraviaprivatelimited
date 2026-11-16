import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const footer = read("components/footer.tsx");
const styles = read("components/footer.module.css");
const registrations = read("lib/corporate/public-registrations.ts");
const approvedIdentity = read("lib/corporate-content.ts");

describe("KRAVIA DPIIT Startup India recognition footer", () => {
  it("reuses the independently reviewed public DPIIT record instead of hardcoding certificate claims", () => {
    expect(footer).toContain('recognition.authority === "Startup India"');
    expect(footer).toContain("startupIndiaRecognition.title");
    expect(footer).toContain("startupIndiaRecognition.reference");
    expect(footer).toContain("href={startupIndiaRecognition.href}");
    expect(registrations).toContain('authority: "Startup India"');
    expect(approvedIdentity).toContain('recognitionNumber: "DIPP281524"');
    expect(approvedIdentity).toContain('statusLabel: "DPIIT Recognised Startup"');
  });

  it("preserves separate NVIDIA program membership and non-endorsement wording", () => {
    expect(footer).toContain('src="/brand/partners/nvidia-inception-member-rgb.svg"');
    expect(footer).toContain("KRAVIA PRIVATE LIMITED is a member of NVIDIA Inception.");
    expect(footer).toContain("They do not endorse KRAVIA products or services.");
    expect(footer).toContain("rel=\"noopener noreferrer\"");
  });

  it("renders a text-based recognition badge, not an unauthorized government logo", () => {
    expect(footer).toContain('className={styles.startupIndiaBadge}');
    expect(footer).toContain('className={styles.programBadgeRow}');
    expect(footer).toContain("<strong>Startup India</strong>");
    expect(footer).not.toMatch(/src="[^"]*(startup-india|startupindia|dpiit)[^"]*"/i);
    expect(styles).toContain(".startupIndiaBadge");
    expect(styles).toContain(".programBadgeRow");
    expect(styles).toContain("flex-wrap: wrap");
    expect(styles).toContain("width: min(218px, 100%)");
  });
});
