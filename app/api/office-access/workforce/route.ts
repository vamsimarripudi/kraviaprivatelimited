import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  assignAccessProfile,
  assignWorkforceJob,
  changeDeviceTrust,
  getWorkforceAdministrationState,
  registerWorkforceDevice,
  revokeAccessProfile,
  setPermissionOverride,
  WorkforceAdminError,
} from "@/lib/office/workforce-admin-server";
import { officeDepartments } from "@/lib/office/access-policy";

const scope = z.enum(["COMPANY", "DEPARTMENT", "TEAM", "PRODUCT", "PROJECT", "REPOSITORY", "COST_CENTER", "OWN"]);
const employment = z.enum(["EMPLOYEE", "CONTRACTOR", "INTERN", "TRAINEE", "ADVISOR", "PROFESSIONAL"]);
const deviceKind = z.enum(["DESKTOP", "LAPTOP", "MOBILE", "TABLET", "OTHER"]);
const department = z.enum(officeDepartments);
const reason = z.string().trim().min(3).max(500);

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ASSIGN_JOB"), target_user_id: z.string().uuid(), position: z.string().trim().min(2).max(100), department, reports_to: z.string().uuid().optional(), team_key: z.string().trim().max(120).optional(), product_key: z.string().trim().max(120).optional(), employment_type: employment, reason }),
  z.object({ action: z.literal("ASSIGN_PROFILE"), target_user_id: z.string().uuid(), profile: z.string().trim().min(2).max(100), scope_type: scope, scope_key: z.string().trim().max(240).optional(), reason, expires_at: z.string().datetime().optional() }),
  z.object({ action: z.literal("REVOKE_PROFILE"), target_user_id: z.string().uuid(), assignment_id: z.string().uuid(), reason }),
  z.object({ action: z.literal("SET_PERMISSION"), target_user_id: z.string().uuid(), permission: z.string().trim().min(2).max(160), effect: z.enum(["ALLOW", "DENY"]), scope_type: scope, scope_key: z.string().trim().max(240).optional(), reason, expires_at: z.string().datetime().optional() }),
  z.object({ action: z.literal("REGISTER_DEVICE"), target_user_id: z.string().uuid(), label: z.string().trim().min(2).max(120), kind: deviceKind, platform: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal("DEVICE_TRUST"), target_user_id: z.string().uuid(), device_id: z.string().uuid(), trust_action: z.enum(["APPROVE", "REVOKE"]), company_managed: z.boolean().optional(), reason }),
]);

export async function GET() {
  try {
    const state = await getWorkforceAdministrationState();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof WorkforceAdminError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to load workforce administration";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) return NextResponse.json({ detail: "Cross-origin workforce mutation is not allowed" }, { status: 403 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid workforce-administration request" }, { status: 400 });

  try {
    const input = parsed.data;
    let result: unknown;
    if (input.action === "ASSIGN_JOB") {
      result = await assignWorkforceJob({ targetUserId: input.target_user_id, position: input.position, department: input.department, reportsTo: input.reports_to, teamKey: input.team_key, productKey: input.product_key, employmentType: input.employment_type, reason: input.reason });
    } else if (input.action === "ASSIGN_PROFILE") {
      result = await assignAccessProfile({ targetUserId: input.target_user_id, profile: input.profile, scopeType: input.scope_type, scopeKey: input.scope_key, reason: input.reason, expiresAt: input.expires_at });
    } else if (input.action === "REVOKE_PROFILE") {
      result = await revokeAccessProfile({ targetUserId: input.target_user_id, assignmentId: input.assignment_id, reason: input.reason });
    } else if (input.action === "SET_PERMISSION") {
      result = await setPermissionOverride({ targetUserId: input.target_user_id, permission: input.permission, effect: input.effect, scopeType: input.scope_type, scopeKey: input.scope_key, reason: input.reason, expiresAt: input.expires_at });
    } else if (input.action === "REGISTER_DEVICE") {
      result = await registerWorkforceDevice({ targetUserId: input.target_user_id, label: input.label, kind: input.kind, platform: input.platform });
    } else {
      result = await changeDeviceTrust({ targetUserId: input.target_user_id, deviceId: input.device_id, action: input.trust_action, companyManaged: input.company_managed, reason: input.reason });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof WorkforceAdminError ? error.status : 500;
    const detail = error instanceof Error ? error.message : "Unable to mutate workforce administration";
    return NextResponse.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
