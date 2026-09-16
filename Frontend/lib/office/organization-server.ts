import "server-only";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

export class OfficeOrganizationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeOrganizationError";
  }
}

export async function getOfficeOrganization() {
  const { admin, identity } = await requireOfficeActor();
  const decision = await resolveOfficePermission(admin, identity, "people.basic.read", { type: "COMPANY" });
  if (!decision.allowed) throw new OfficeOrganizationError(403, decision.reason);

  const [jobs, identities, positions] = await Promise.all([
    admin.from("office_job_assignments").select("user_id,position_code,department_code,reports_to_user_id,team_key,product_key,employment_type,status,start_date").eq("status", "ACTIVE").order("department_code", { ascending: true }),
    admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE"),
    admin.from("office_position_catalog").select("code,label,family,level,is_manager").eq("active", true),
  ]);
  if (jobs.error || identities.error || positions.error) throw new OfficeOrganizationError(500, "Unable to read the governed organization directory");

  const identityMap = new Map((identities.data ?? []).map((row) => [row.user_id, row]));
  const positionMap = new Map((positions.data ?? []).map((row) => [row.code, row]));
  return {
    viewer: identity.userId,
    people: (jobs.data ?? []).map((job) => ({ ...job, identity: identityMap.get(job.user_id) ?? null, position: positionMap.get(job.position_code) ?? null })),
  };
}
