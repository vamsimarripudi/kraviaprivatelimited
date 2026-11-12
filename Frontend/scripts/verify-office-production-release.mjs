/**
 * Run only after the one approved production deployment.
 *
 * The custom-domain release fingerprint is authoritative. A green GitHub
 * status or a Vercel "Ignored Build Step" skip is NOT successful deployment.
 *
 * Usage:
 *   EXPECTED_KRAVIA_COMMIT=<40-character Git SHA> npm run verify:office-production
 */
export const OFFICE_RELEASE_URL = "https://www.kraviaprivatelimited.com/api/office-release";

export function assertOfficeProductionFingerprint(payload, expectedSha) {
  if (!/^[a-f0-9]{40}$/i.test(expectedSha)) {
    throw new Error("EXPECTED_KRAVIA_COMMIT must be the exact 40-character approved main SHA");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Production fingerprint response is invalid");
  }
  if (payload.application !== "KRAVIA Office" || payload.environment !== "production") {
    throw new Error("The custom domain did not report KRAVIA Office production");
  }
  if (typeof payload.commit !== "string" || payload.commit !== expectedSha.slice(0, 12)) {
    throw new Error(
      "Production is not serving the approved Git SHA: expected " +
      expectedSha.slice(0, 12) + ", received " + String(payload.commit || "unavailable"),
    );
  }
  return { valid:true, commit:payload.commit, release:String(payload.release || "unavailable") };
}

async function main() {
  const expected = process.env.EXPECTED_KRAVIA_COMMIT || "";
  if (!/^[a-f0-9]{40}$/i.test(expected)) {
    throw new Error("Set EXPECTED_KRAVIA_COMMIT to the exact, tested main branch commit SHA");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(OFFICE_RELEASE_URL, {
      redirect:"error",
      cache:"no-store",
      headers:{ Accept:"application/json", "Cache-Control":"no-store" },
      signal:controller.signal,
    });
    if (!response.ok) throw new Error("Production fingerprint HTTP " + response.status);
    const payload = await response.json();
    const verdict = assertOfficeProductionFingerprint(payload, expected);
    process.stdout.write("Verified KRAVIA Office production at custom domain: " +
      verdict.commit + " (" + verdict.release + ")\n");
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] && import.meta.url.endsWith("/" + process.argv[1].split(/[\\/]/).at(-1))) {
  main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : "Production verification failed") + "\n");
    process.exitCode = 1;
  });
}
