import "server-only";

import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

export class OfficeRolePackageError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeRolePackageError";
  }
}

type PackageDraft = {
  code: string;
  label: string;
  description: string;
  department: string;
  position: string;
  employmentType: "EMPLOYEE" | "CONTRACTOR" | "INTERN" | "TRAINEE" | "ADVISOR" | "PROFESSIONAL";
  responsibilities: string[];
  additionalRoles: Array<{
    position_code: string;
    department_code: string;
    responsibilities?: string[];
  }>;
  profiles: Array<{
    profile_code: string;
    scope_type: "DEPARTMENT" | "COMPANY" | "TEAM" | "PRODUCT" | "PROJECT" | "REPOSITORY" | "COST_CENTER" | "OWN";
    scope_key?: string;
  }>;
  steps: Array<{ code: string; label: string; required: boolean }>;
  workPattern: {
    days: string[];
    daily_minutes: number;
    weekly_minutes: number;
    flexible: boolean;
    time_zone: "Asia/Kolkata";
  };
};

type RolePackageAction =
  | { action: "CREATE"; draft: PackageDraft }
  | { action: "PUBLISH"; packageId: string }
  | { action: "APPLY"; packageId: string; employeeId: string; reason: string }
  | { action: "BULK_APPLY"; packageId: string; employeeIds: string[]; reason: string }
  | { action: "TASK"; taskId: string; decision: "SUBMIT" | "VERIFY" | "RETURN" | "WAIVE"; reference?: string; note?: string };

function check(result: { error?: { message?: string } | null }, message: string) {
  if (result.error) throw new OfficeRolePackageError(503, message);
}

/**
 * The same model serves the Founder role studio and each employee's own profile.
 * Never return the company directory or other staff's onboarding evidence to
 * non-administrators. The catalogues are the source of truth, not hardcoded roles.
 */
export async function getRolePackageWorkspace(employeeId?: string) {
  const { admin, identity } = await requireOfficeActor();
  const actorId = identity.userId;
  const assign = await resolveOfficePermission(admin, identity, "access.profile.assign", { type: "COMPANY" });
  const manager = identity.roles.some((role) => role === "OWNER" || role === "ADMIN") && assign.allowed;
  const targetId = employeeId || actorId;
  if (targetId !== actorId && !manager) throw new OfficeRolePackageError(403, "Other employees' role records are restricted");

  const selected = await admin.from("office_identity_users")
    .select("user_id,display_name,job_title,primary_department,status")
    .eq("user_id", targetId).maybeSingle();
  check(selected, "Employee identity could not be verified");
  if (!selected.data) throw new OfficeRolePackageError(404, "Employee not found");

  const employmentResult = await admin.from("office_employment_registry")
    .select("employment_code,relationship_type,status,start_date,end_date,source")
    .eq("identity_user_id", targetId)
    .order("created_at", { ascending: false }).limit(5);
  check(employmentResult, "Employment registry could not be verified");
  const employment = employmentResult.data?.[0] ?? null;

  const applicationsQuery = admin.from("office_employee_role_package_applications")
    .select("id,package_id,employee_user_id,applied_at,applied_by,snapshot,reason")
    .eq("employee_user_id", targetId)
    .order("applied_at", { ascending: false }).limit(100);
  const tasksQuery = admin.from("office_role_package_onboarding_tasks")
    .select("id,application_id,employee_user_id,task_code,label,required,status,evidence_reference,submitted_at,reviewed_at,review_note")
    .eq("employee_user_id", targetId).limit(240);
  const positionsQuery = admin.from("office_employee_functional_positions")
    .select("position_code,department_code,application_id,responsibilities,active")
    .eq("employee_user_id", targetId).eq("active", true);

  const [applications, tasks, functionalPositions] = await Promise.all([applicationsQuery, tasksQuery, positionsQuery]);
  for (const r of [applications, tasks, functionalPositions]) check(r, "Employee role package evidence is unavailable");

  if (!manager) {
    return {
      actor: { user_id: actorId, can_manage: false },
      employee: selected.data, employment,
      applications: applications.data ?? [],
      tasks: tasks.data ?? [],
      functional_positions: functionalPositions.data ?? [],
      templates: [], people: [], departments: [], positions: [], access_profiles: [],
      notice: "Positions are context, scoped access profiles are permissions. Wages and department ownership require separate approvals.",
    };
  }

  const [templates, people, departments, positions, accessProfiles] = await Promise.all([
    admin.from("office_role_packages")
      .select("id,code,version,label,description,department_code,primary_position_code,employment_type,responsibilities,additional_roles,access_profiles,onboarding_steps,work_pattern,status,created_at,created_by,published_at")
      .order("created_at", { ascending: false }).limit(250),
    admin.from("office_identity_users")
      .select("user_id,display_name,job_title,primary_department,status")
      .in("status", ["ACTIVE","INVITED"]).order("display_name").limit(300),
    admin.from("office_department_catalog")
      .select("code,label,active").eq("active", true).order("label"),
    admin.from("office_position_catalog")
      .select("code,label,family,level,is_manager,active")
      .eq("active", true).order("label"),
    admin.from("office_access_profile_catalog")
      .select("code,label,category,description,assignable_by_admin,owner_managed_only,active")
      .eq("active", true).order("label"),
  ]);
  for (const r of [templates, people, departments, positions, accessProfiles]) {
    check(r, "The reusable position and access catalogues are unavailable");
  }

  return {
    actor: { user_id: actorId, can_manage: true, is_founder: identity.roles.includes("OWNER") },
    employee: selected.data, employment,
    applications: applications.data ?? [],
    tasks: tasks.data ?? [],
    functional_positions: functionalPositions.data ?? [],
    templates: templates.data ?? [],
    people: people.data ?? [],
    departments: departments.data ?? [],
    positions: positions.data ?? [],
    access_profiles: accessProfiles.data ?? [],
    notice: "One published, versioned package can be applied to any authorised employee. Applying it never creates an identity, issues salary, confirms a document or transfers department ownership.",
  };
}

/** All writes go through existing audited Office RPCs and one atomic package apply. */
export async function changeRolePackage(input: RolePackageAction) {
  const { admin, identity } = await requireOfficeActor();
  if (identity.aal !== "aal2") {
    throw new OfficeRolePackageError(403, "Verified MFA session is required to modify workforce authority");
  }
  const actorId = identity.userId;
  let method: string;
  let params: Record<string, unknown>;

  if (input.action === "CREATE") {
    const d = input.draft;
    method = "office_role_package_create";
    params = {
      p_actor: actorId, p_code: d.code, p_label: d.label, p_description: d.description,
      p_department: d.department, p_position: d.position, p_employment: d.employmentType,
      p_responsibilities: d.responsibilities, p_additional_roles: d.additionalRoles,
      p_profiles: d.profiles, p_steps: d.steps, p_work_pattern: d.workPattern,
    };
  } else if (input.action === "PUBLISH") {
    method = "office_role_package_publish";
    params = { p_actor: actorId, p_package: input.packageId };
  } else if (input.action === "APPLY") {
    method = "office_role_package_apply";
    params = { p_actor: actorId, p_target: input.employeeId,
      p_package: input.packageId, p_reason: input.reason };
  } else if (input.action === "BULK_APPLY") {
    method = "office_role_package_apply_many";
    params = { p_actor: actorId, p_targets: input.employeeIds,
      p_package: input.packageId, p_reason: input.reason };
  } else {
    method = "office_role_package_task_decide";
    params = { p_actor: actorId, p_task: input.taskId, p_action: input.decision,
      p_reference: input.reference || null, p_note: input.note || null };
  }

  const { data, error } = await admin.rpc(method, params);
  if (error) throw new OfficeRolePackageError(409, error.message || "Role package action rejected");
  return { result: data };
}
