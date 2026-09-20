import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const broker = readFileSync(
  new URL("../../Database/supabase/functions/kravia-storage-broker/index.ts", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("../../Backend/backend/storage_broker_client.py", import.meta.url),
  "utf8",
);

describe("KRAVIA private storage broker", () => {
  it("keeps the live storage broker source versioned with an explicit bucket allowlist", () => {
    for (const bucket of [
      "office-quarantine",
      "corporate-private",
      "office-documents",
      "office-candidate-documents",
    ]) {
      expect(broker).toContain(`"${bucket}"`);
    }
    expect(broker).toContain("safePath");
    expect(broker).toContain('!path.includes("..")');
  });

  it("uses a signed server-to-server authority instead of browser identity", () => {
    expect(broker).toContain("x-kravia-timestamp");
    expect(broker).toContain("x-kravia-signature");
    expect(broker).toContain("ECDSA");
    expect(client).toContain("KRAVIA_STORAGE_BROKER_PRIVATE_KEY");
    expect(client).toContain("x-kravia-signature");
  });

  it("limits the broker to signed upload, signed download and delete operations", () => {
    expect(broker).toContain('action === "signed_upload"');
    expect(broker).toContain('action === "signed_download"');
    expect(broker).toContain('action === "delete"');
    expect(broker).toContain('"Unsupported action"');
  });

  it("keeps private download links short lived", () => {
    expect(broker).toContain("Math.max(15, Math.min");
    expect(client).toContain("max(15, min(int(expires_in), 300))");
  });
});
