/**
 * Founder bootstrap creates a password and must never be public by accident.
 * A production deploy needs an explicit, server-only, short-lived opt-in.
 */
type BootstrapEnvironment = Readonly<Record<string, string | undefined>>;

export function founderBootstrapIsPermitted(environment: BootstrapEnvironment = process.env) {
  return environment.KRAVIA_ALLOW_FOUNDER_BOOTSTRAP === "true";
}
