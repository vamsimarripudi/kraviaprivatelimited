import { requireAuthenticatedUser, SupabaseAuthenticationError } from "@/lib/supabase/auth";
import { hasCapability, requiresAal2, type Capability, type CorporateRole } from "@/lib/corporate/permissions";

export class CorporateAccessError extends Error { constructor(message: string, public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "CONFIGURATION_REQUIRED") { super(message); } }
export type CorporateActor = { id: string; email: string | undefined; role: CorporateRole; aal: "aal1" | "aal2" };
/** Proxy is only an early redirect. This server-side check is the application authorization boundary. */
export async function requireCorporateCapability(capability: Capability): Promise<CorporateActor> {
  let identity: Awaited<ReturnType<typeof requireAuthenticatedUser>>;
  try { identity = await requireAuthenticatedUser(); }
  catch (error) { if (error instanceof SupabaseAuthenticationError) throw new CorporateAccessError(error.message, error.code); throw error; }
  const { supabase, user } = identity;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.role) throw new CorporateAccessError("No active Corporate Office role is assigned.", "FORBIDDEN");
  const role = profile.role as CorporateRole;
  if (!hasCapability(role, capability)) throw new CorporateAccessError("Your role is not authorised for this action.", "FORBIDDEN");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = assurance?.currentLevel === "aal2" ? "aal2" : "aal1";
  if (requiresAal2(capability) && aal !== "aal2") throw new CorporateAccessError("Multi-factor step-up authentication is required for this action.", "MFA_REQUIRED");
  return { id: user.id, email: user.email, role, aal };
}
