import { createClient } from "@/lib/supabase/server";
import { hasCapability, requiresAal2, type Capability, type CorporateRole } from "@/lib/corporate/permissions";

export class CorporateAccessError extends Error {
  constructor(message: string, public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "CONFIGURATION_REQUIRED") {
    super(message);
  }
}

export type CorporateActor = { id: string; email: string | undefined; role: CorporateRole; aal: "aal1" | "aal2" };

/** Server-side enforcement for actions. Proxy only provides an early redirect; it is never the authorization boundary. */
export async function requireCorporateCapability(capability: Capability): Promise<CorporateActor> {
  const supabase = await createClient();
  if (!supabase) throw new CorporateAccessError("Corporate identity is not configured.", "CONFIGURATION_REQUIRED");

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) throw new CorporateAccessError("Sign in is required.", "UNAUTHENTICATED");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.user.id)
    .maybeSingle();
  if (profileError || !profile?.role) throw new CorporateAccessError("No active Corporate Office role is assigned.", "FORBIDDEN");

  const role = profile.role as CorporateRole;
  if (!hasCapability(role, capability)) throw new CorporateAccessError("Your role is not authorised for this action.", "FORBIDDEN");

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = assurance?.currentLevel === "aal2" ? "aal2" : "aal1";
  if (requiresAal2(capability) && aal !== "aal2") throw new CorporateAccessError("Multi-factor step-up authentication is required for this action.", "MFA_REQUIRED");

  return { id: userResult.user.id, email: userResult.user.email, role, aal };
}
