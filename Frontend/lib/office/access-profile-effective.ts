/** Align navigation capability snapshots with the server's effective-dated grants. */
export type OfficeAccessProfileWindow = {
  status?: string | null;
  effective_from?: string | null;
  expires_at?: string | null;
};

export function officeAccessProfileIsEffective(
  profile: OfficeAccessProfileWindow,
  now = Date.now(),
): boolean {
  if (profile.status !== undefined && profile.status !== "ACTIVE") return false;
  if (profile.effective_from !== undefined && profile.effective_from !== null) {
    if (typeof profile.effective_from !== "string" || !profile.effective_from.trim()) return false;
    const startsAt = Date.parse(profile.effective_from);
    if (!Number.isFinite(startsAt) || startsAt > now) return false;
  }
  if (profile.expires_at !== undefined && profile.expires_at !== null) {
    if (typeof profile.expires_at !== "string" || !profile.expires_at.trim()) return false;
    const expiresAt = Date.parse(profile.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  }
  return true;
}
