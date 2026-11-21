import { NextResponse } from "next/server";
import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight, read-only self-navigation source. This is NOT a permission API.
 *
 * The handover management API loads transfer history and a company people
 * directory, neither of which belongs on the navigation critical path.
 * The BFF checks the current signed-in actor and returns only departments
 * owned by that actor or their own assigned primary department. Individual
 * route capabilities and database-authorized mutations still fail closed.
 */
export async function GET() {
  const started = performance.now();
  const headers = {
    "Cache-Control": "private, no-store",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
  } as const;
  try {
    const { admin, identity } = await requireOfficeActor();
    const [owned, catalog] = await Promise.all([
      admin.from("office_department_ownership")
        .select("department_code,owner_user_id")
        .eq("owner_user_id", identity.userId),
      admin.from("office_department_catalog")
        .select("code,label")
        .eq("active", true),
    ]);
    if (owned.error || catalog.error) throw new Error("Department registry unavailable");
    const primary = (identity.department ?? "").toUpperCase();
    const available = new Set((catalog.data ?? []).map(row => String(row.code)));
    const ownCodes = new Set((owned.data ?? []).map(row => String(row.department_code))
      .filter(code => available.has(code)));
    if (available.has(primary)) ownCodes.add(primary);
    const departments = (catalog.data ?? [])
      .filter(item => ownCodes.has(String(item.code)))
      .map(item => ({code: String(item.code), label: String(item.label)}))
      .sort((a,b) => a.label.localeCompare(b.label));
    return NextResponse.json({
      actor: {user_id: identity.userId},
      departments,
      ownership: (owned.data ?? []).filter(item => ownCodes.has(String(item.department_code)))
        .map(item => ({
          department_code: String(item.department_code),
          owner_user_id: identity.userId,
        })),
    }, {
      headers: {...headers, "Server-Timing": `department_lookup;dur=${(performance.now()-started).toFixed(1)}`},
    });
  } catch (error) {
    const status = error instanceof OfficePermissionError ? error.status : 503;
    return NextResponse.json({
      detail: error instanceof OfficePermissionError ? error.message : "Assigned departments temporarily unavailable",
    }, {status, headers});
  }
}
