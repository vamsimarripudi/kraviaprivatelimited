import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } as const;
const uuid = z.string().uuid();
const reason = z.string().trim().min(12).max(500);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RECORD_CONTACT"), employee_user_id: uuid,
    email: z.string().trim().email().max(320),
    source: z.enum(["SIGNED_EXIT_FORM", "VERIFIED_EMPLOYEE_REPLY", "SIGNED_EMPLOYMENT_CONSENT"]),
    evidence_reference: z.string().trim().min(12).max(500), reason,
  }).strict(),
  z.object({
    action: z.literal("REVIEW_CONTACT"), employee_user_id: uuid,
    approve: z.boolean(), reason,
  }).strict(),
  z.object({
    action: z.literal("REVOKE_CONTACT"), employee_user_id: uuid, reason,
  }).strict(),
  z.object({
    action: z.literal("OPEN_SETTLEMENT"), employee_user_id: uuid,
    offboarding_request_id: uuid, payroll_result_id: uuid, reason,
  }).strict(),
  z.object({
    action: z.literal("VERIFY_SETTLEMENT"), settlement_case_id: uuid, reason,
  }).strict(),
  z.object({
    action: z.literal("RECORD_COMPLETION"), settlement_case_id: uuid, reason,
  }).strict(),
]);

type Current = Awaited<ReturnType<typeof requireOfficeActor>>;

async function permissions(current: Current) {
  const owner = current.identity.roles.includes("OWNER");
  const [people, payroll] = await Promise.all([
    resolveOfficePermission(current.admin, current.identity, "people.update", { type: "COMPANY" }),
    resolveOfficePermission(current.admin, current.identity, "payroll.run.review", { type: "COMPANY" }),
  ]);
  if (!people.allowed && !owner) throw new OfficePermissionError(403, "Company People authority required");
  return { owner, people: people.allowed, payroll: payroll.allowed };
}

function failure(error: unknown) {
  const status = error instanceof OfficePermissionError ? error.status : 503;
  return NextResponse.json({
    detail: error instanceof OfficePermissionError ? error.message : "Exit governance could not be verified",
  }, { status, headers });
}

function masked(email: string | null | undefined) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  return local && domain ? local.slice(0, 1) + "***@" + domain : null;
}

export async function GET(request: Request) {
  try {
    const current = await requireOfficeActor();
    const auth = await permissions(current);
    const id = uuid.parse(new URL(request.url).searchParams.get("employee_user_id"));
    const [person, contact, cases, requests, payroll] = await Promise.all([
      current.admin.from("office_identity_users")
        .select("user_id,display_name,status").eq("user_id", id).maybeSingle(),
      current.admin.from("office_exit_contact_evidence")
        .select("employee_user_id,personal_email,status,consent_source,evidence_reference,recorded_by,recorded_at,reviewed_by,reviewed_at,expires_at,version,revoked_at")
        .eq("employee_user_id", id).maybeSingle(),
      current.admin.from("office_exit_settlement_cases")
        .select("id,status,opened_at,opened_by,verified_at,verified_by,offboarding_request_id,payroll_result_id")
        .eq("employee_user_id", id).order("opened_at", { ascending: false }).limit(30),
      current.admin.from("office_requests").select("id,status,created_at")
        .eq("target_user_id", id).eq("request_type_code", "EMPLOYEE_OFFBOARDING")
        .order("created_at", { ascending: false }).limit(20),
      auth.payroll || auth.owner
        ? current.admin.from("office_payroll_results").select("id,status,period_id,net_pay_minor,currency")
          .eq("employee_user_id", id).eq("status", "LOCKED").limit(30)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (person.error || !person.data || contact.error || cases.error || requests.error || payroll.error) {
      return NextResponse.json({ detail: "Verified employee exit information is unavailable" }, { status: 503, headers });
    }
    const row = contact.data;
    return NextResponse.json({
      employee: person.data,
      contact: row ? {
        status: row.status, consent_source: row.consent_source,
        evidence_reference: row.evidence_reference,
        recorded_at: row.recorded_at, recorded_by: row.recorded_by,
        reviewed_by: row.reviewed_by, reviewed_at: row.reviewed_at,
        expires_at: row.expires_at, version: row.version,
        recipient: auth.owner ? row.personal_email : masked(row.personal_email),
      } : null,
      cases: cases.data ?? [], requests: requests.data ?? [],
      payroll: payroll.data ?? [],
      capabilities: {
        people: auth.people || auth.owner,
        owner: auth.owner,
        finance: auth.payroll || auth.owner,
      },
      note: "Personal contact requires explicit evidence and separate Owner verification. No message is sent by viewing or changing exit governance.",
    }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ detail: "Valid employee ID required" }, { status: 400, headers });
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request)) {
    return NextResponse.json({ detail: "Cross-origin exit mutation prohibited" }, { status: 403, headers });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ detail: "Invalid governed exit action" }, { status: 400, headers });
  try {
    const current = await requireOfficeActor();
    const auth = await permissions(current);
    const input = parsed.data;
    if ((input.action === "REVIEW_CONTACT" || input.action === "VERIFY_SETTLEMENT" || input.action === "RECORD_COMPLETION") && !auth.owner) {
      throw new OfficePermissionError(403, "Separate Owner approval required");
    }
    if (input.action === "OPEN_SETTLEMENT" && (!auth.payroll || !auth.people)) {
      throw new OfficePermissionError(403, "People and Finance permissions required to prepare settlement");
    }
    if ((input.action === "RECORD_CONTACT" || input.action === "REVOKE_CONTACT") && !auth.people) {
      throw new OfficePermissionError(403, "People permission required for contact evidence");
    }
    const args: Record<string, unknown> = { p_actor: current.identity.userId, p_reason: input.reason };
    let operation: string;
    switch (input.action) {
      case "RECORD_CONTACT":
        operation = "office_exit_contact_record";
        Object.assign(args, {
          p_employee: input.employee_user_id, p_email: input.email,
          p_source: input.source, p_reference: input.evidence_reference,
        });
        break;
      case "REVIEW_CONTACT":
        operation = "office_exit_contact_decide";
        Object.assign(args, { p_employee: input.employee_user_id, p_approved: input.approve });
        break;
      case "REVOKE_CONTACT":
        operation = "office_exit_contact_revoke";
        Object.assign(args, { p_employee: input.employee_user_id });
        break;
      case "OPEN_SETTLEMENT":
        operation = "office_exit_settlement_open";
        Object.assign(args, {
          p_employee: input.employee_user_id,
          p_request: input.offboarding_request_id,
          p_result: input.payroll_result_id,
        });
        break;
      case "VERIFY_SETTLEMENT":
        operation = "office_exit_settlement_verify";
        Object.assign(args, { p_case: input.settlement_case_id });
        break;
      case "RECORD_COMPLETION":
        operation = "office_exit_completion_record";
        Object.assign(args, { p_case: input.settlement_case_id });
        break;
    }
    const result = await current.admin.rpc(operation, args);
    if (result.error || result.data === null || result.data === false) {
      return NextResponse.json({
        detail: "Real source evidence, independent reviewer, settlement, or permission checks were not satisfied",
      }, { status: 409, headers });
    }
    return NextResponse.json({ saved: true, reference: result.data }, { headers });
  } catch (error) {
    return failure(error);
  }
}
