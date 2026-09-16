import "server-only";
import { createOfficeServiceClient, OfficePermissionError } from "@/lib/office/permission-engine";
import { getOfficeSessionContext, officeIdentityIsProvisioned } from "@/lib/office/auth-server";

export class OfficeWorkflowError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeWorkflowError";
  }
}

async function requireWorkflowActor() {
  const context = await getOfficeSessionContext();
  if (!context || !officeIdentityIsProvisioned(context.identity)) throw new OfficeWorkflowError(401, "Office sign-in required");
  if (context.identity.aal !== "aal2") throw new OfficeWorkflowError(403, "AAL2 verification is required");
  try {
    return { admin: createOfficeServiceClient(), identity: context.identity };
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeWorkflowError(error.status, error.message);
    throw new OfficeWorkflowError(503, "Trusted Office workflow service is not configured");
  }
}

function throwIf(error: { message?: string } | null, message: string) {
  if (error) throw new OfficeWorkflowError(500, message);
}

export async function getOfficeWorkOverview() {
  const { admin, identity } = await requireWorkflowActor();
  const [job, profiles, requestTypes, myRequests, notifications, devices, reports] = await Promise.all([
    admin.from("office_job_assignments").select("user_id,position_code,department_code,reports_to_user_id,team_key,product_key,employment_type,status").eq("user_id", identity.userId).maybeSingle(),
    admin.from("office_user_access_profiles").select("id,profile_code,scope_type,scope_key,status,expires_at").eq("user_id", identity.userId).eq("status", "ACTIVE").order("created_at", { ascending: true }),
    admin.from("office_request_type_catalog").select("code,label,module,description,default_priority,default_due_hours,high_risk").eq("active", true).order("module", { ascending: true }).order("label", { ascending: true }),
    admin.from("office_requests").select("id,request_type_code,requester_user_id,requester_department,target_user_id,resource_type,resource_key,title,description,payload,priority,status,current_step_order,due_at,submitted_at,completed_at,created_at,updated_at").eq("requester_user_id", identity.userId).order("created_at", { ascending: false }).limit(100),
    admin.from("office_notifications").select("id,request_id,kind,title,body,status,created_at,read_at").eq("user_id", identity.userId).order("created_at", { ascending: false }).limit(40),
    admin.from("office_device_registry").select("id,device_label,device_kind,platform,trust_state,company_managed,approved_at,revoked_at,last_seen_at,created_at").eq("user_id", identity.userId).order("created_at", { ascending: false }),
    admin.from("office_job_assignments").select("user_id,position_code,department_code,team_key,product_key,employment_type,status").eq("reports_to_user_id", identity.userId).eq("status", "ACTIVE").order("created_at", { ascending: true }),
  ]);

  throwIf(job.error, "Unable to read workforce assignment");
  throwIf(profiles.error, "Unable to read access profiles");
  throwIf(requestTypes.error, "Unable to read request catalog");
  throwIf(myRequests.error, "Unable to read requests");
  throwIf(notifications.error, "Unable to read notifications");
  throwIf(devices.error, "Unable to read device registry");
  throwIf(reports.error, "Unable to read reporting line");

  const myRequestRows = myRequests.data ?? [];
  const myRequestIds = myRequestRows.map((row) => row.id);
  const { data: mySteps, error: myStepsError } = myRequestIds.length
    ? await admin.from("office_request_steps").select("id,request_id,step_order,step_code,label,approver_selector,approver_value,required_permission,assigned_user_id,status,decision_by,decision_note,decided_at,created_at").in("request_id", myRequestIds).order("step_order", { ascending: true })
    : { data: [], error: null };
  throwIf(myStepsError, "Unable to read request workflow steps");

  const { data: approvalSteps, error: approvalError } = await admin
    .from("office_request_steps")
    .select("id,request_id,step_order,step_code,label,approver_selector,approver_value,required_permission,assigned_user_id,status,decision_by,decision_note,decided_at,created_at")
    .eq("assigned_user_id", identity.userId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  throwIf(approvalError, "Unable to read approval inbox");

  const approvalRequestIds = Array.from(new Set((approvalSteps ?? []).map((step) => step.request_id)));
  const { data: approvalRequests, error: approvalRequestError } = approvalRequestIds.length
    ? await admin.from("office_requests").select("id,request_type_code,requester_user_id,requester_department,target_user_id,resource_type,resource_key,title,description,payload,priority,status,current_step_order,due_at,submitted_at,completed_at,created_at,updated_at").in("id", approvalRequestIds)
    : { data: [], error: null };
  throwIf(approvalRequestError, "Unable to read approval requests");

  const reportRows = reports.data ?? [];
  const reportIds = reportRows.map((row) => row.user_id);
  const { data: reportIdentities, error: reportIdentityError } = reportIds.length
    ? await admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").in("user_id", reportIds)
    : { data: [], error: null };
  throwIf(reportIdentityError, "Unable to read direct-report identities");

  const { data: teamRequests, error: teamRequestError } = reportIds.length
    ? await admin.from("office_requests").select("id,request_type_code,requester_user_id,requester_department,target_user_id,resource_type,resource_key,title,description,payload,priority,status,current_step_order,due_at,submitted_at,completed_at,created_at,updated_at").in("requester_user_id", reportIds).order("created_at", { ascending: false }).limit(100)
    : { data: [], error: null };
  throwIf(teamRequestError, "Unable to read team requests");

  const stepsByRequest = new Map<string, unknown[]>();
  for (const step of mySteps ?? []) {
    const current = stepsByRequest.get(step.request_id) ?? [];
    current.push(step);
    stepsByRequest.set(step.request_id, current);
  }
  const approvalByRequest = new Map((approvalRequests ?? []).map((request) => [request.id, request]));
  const reportIdentityMap = new Map((reportIdentities ?? []).map((row) => [row.user_id, row]));

  return {
    identity: {
      user_id: identity.userId,
      email: identity.email ?? null,
      roles: identity.roles,
      department: identity.department ?? null,
      authorization_version: identity.authzVersion,
    },
    job: job.data ?? null,
    profiles: profiles.data ?? [],
    request_types: requestTypes.data ?? [],
    requests: myRequestRows.map((request) => ({ ...request, steps: stepsByRequest.get(request.id) ?? [] })),
    approvals: (approvalSteps ?? []).map((step) => ({ step, request: approvalByRequest.get(step.request_id) ?? null })),
    notifications: notifications.data ?? [],
    devices: devices.data ?? [],
    direct_reports: reportRows.map((row) => ({ ...row, identity: reportIdentityMap.get(row.user_id) ?? null })),
    team_requests: teamRequests ?? [],
  };
}

export async function createOfficeRequest(input: {
  requestType: string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  targetUserId?: string;
  resourceType?: string;
  resourceKey?: string;
}) {
  const { admin, identity } = await requireWorkflowActor();
  const { data, error } = await admin.rpc("office_create_request", {
    p_requester: identity.userId,
    p_request_type: input.requestType,
    p_title: input.title,
    p_description: input.description,
    p_payload: input.payload ?? {},
    p_priority: input.priority ?? "NORMAL",
    p_target_user: input.targetUserId ?? null,
    p_resource_type: input.resourceType ?? null,
    p_resource_key: input.resourceKey ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeWorkflowError(400, error?.message ?? "Unable to create request");
  return { request_id: data };
}

export async function decideOfficeRequest(input: { requestId: string; decision: "APPROVE" | "REJECT"; note?: string }) {
  const { admin, identity } = await requireWorkflowActor();
  const { data, error } = await admin.rpc("office_decide_request", {
    p_actor: identity.userId,
    p_request: input.requestId,
    p_decision: input.decision,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeWorkflowError(400, error?.message ?? "Unable to record request decision");
  return { status: data };
}
