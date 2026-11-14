/**
 * A role split is a non-additive disclosure of the existing monthly gross.
 * No role line creates an additional salary, payout, allowance, or statutory
 * entitlement until the parent effective-dated compensation is approved.
 */
export type RoleCompensationPart = {
  code: string;
  label: string;
  kind: "OTHER";
  amount_minor: number;
  metadata: { role_split: true; non_additive: true; order: number };
};

export function parseRoleCompensationSplit(input: string, monthlyGrossMinor: number): RoleCompensationPart[] {
  if (!Number.isSafeInteger(monthlyGrossMinor) || monthlyGrossMinor < 0) {
    throw new Error("Monthly gross must be a valid nonnegative INR amount");
  }
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  if (lines.length > 20) throw new Error("Use no more than 20 role compensation components");
  const seen = new Set<string>();
  const components: RoleCompensationPart[] = lines.map((line, index) => {
    const parts = line.split("|").map(part => part.trim());
    if (parts.length !== 2 || !parts[0] || parts[0].length > 140 || !/^\d+(?:\.\d{1,2})?$/.test(parts[1])) {
      throw new Error("Each role must be entered as Role title | Monthly INR amount");
    }
    const label = parts[0];
    const normalized = label.toLocaleLowerCase("en");
    if (seen.has(normalized)) throw new Error("Duplicate role remuneration line: " + label);
    seen.add(normalized);
    const minor = Math.round(Number(parts[1]) * 100);
    if (!Number.isSafeInteger(minor)) throw new Error("Role remuneration amount is out of range");
    const slug = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55);
    if (!slug) throw new Error("Role titles must contain letters or digits");
    return {
      code: "ROLE_" + String(index + 1).padStart(2, "0") + "_" + slug,
      label,
      kind: "OTHER",
      amount_minor: minor,
      metadata: { role_split: true, non_additive: true, order: index + 1 },
    };
  });
  const total = components.reduce((sum, component) => sum + component.amount_minor, 0);
  if (!Number.isSafeInteger(total) || total !== monthlyGrossMinor) {
    throw new Error("Role remuneration components must add up to exactly the single approved monthly gross");
  }
  return components;
}
