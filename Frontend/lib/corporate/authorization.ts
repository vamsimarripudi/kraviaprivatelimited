import "server-only";

import type { Capability, CorporateRole } from "@/lib/corporate/permissions";

export class CorporateAccessError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "CONFIGURATION_REQUIRED",
  ) {
    super(message);
    this.name = "CorporateAccessError";
  }
}

export type CorporateActor = {
  id: string;
  email: string | undefined;
  role: CorporateRole;
  aal: "aal1" | "aal2";
};

const RETIRED_MESSAGE = "Legacy Corporate Office has moved to KRAVIA Office.";

export async function requireCorporateCapability(_capability: Capability): Promise<CorporateActor> {
  throw new CorporateAccessError(RETIRED_MESSAGE, "FORBIDDEN");
}

export async function requireAnyCorporateCapability(..._capabilities: readonly Capability[]): Promise<CorporateActor> {
  throw new CorporateAccessError(RETIRED_MESSAGE, "FORBIDDEN");
}
