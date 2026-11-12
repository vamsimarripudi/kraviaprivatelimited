export declare const OFFICE_RELEASE_URL: string;
export declare function assertOfficeProductionFingerprint(
  payload: unknown,
  expectedSha: string,
): { valid: true; commit: string; release: string };
