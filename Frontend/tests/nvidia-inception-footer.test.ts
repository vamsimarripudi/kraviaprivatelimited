import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const footer = read("components/footer.tsx");
const styles = read("components/footer.module.css");
const badge = readFileSync(new URL("../public/brand/partners/nvidia-inception-member-rgb.svg", import.meta.url));

describe("KRAVIA NVIDIA Inception membership badge", () => {
  it("uses the exact official RGB screen artwork supplied for the approved membership", () => {
    expect(createHash("sha256").update(badge).digest("hex"))
      .toBe("d2f1fc25616ba02933506b21fa668289169e58ac4c76b5f7f209f2632f289f2e");
    expect(footer).toContain('src="/brand/partners/nvidia-inception-member-rgb.svg"');
    expect(footer).toContain('alt="NVIDIA Inception Program member badge"');
    expect(footer).toContain("unoptimized");
  });

  it("links to the public Inception program and accurately describes membership, not endorsement", () => {
    expect(footer).toContain('href="https://www.nvidia.com/en-in/startups/"');
    expect(footer).toContain("KRAVIA PRIVATE LIMITED is a member of NVIDIA Inception.");
    expect(footer).toContain("They do not endorse KRAVIA products or services.");
    expect(footer).toContain('rel="noopener noreferrer"');
    expect(footer).not.toContain("NVIDIA preferred partner");
    expect(footer).not.toContain("NVIDIA-certified");
  });

  it("keeps the badge in the shared footer with responsive sizing and without CSS image distortion", () => {
    expect(footer).toContain('className={styles.recognitions}');
    expect(footer).toContain('className={styles.inceptionBadge}');
    expect(styles).toContain(".inceptionBadge img");
    expect(styles).toContain("height: auto");
    expect(styles).toContain("object-fit: contain");
    expect(styles).toContain("width: min(218px, 100%)");
  });
});
