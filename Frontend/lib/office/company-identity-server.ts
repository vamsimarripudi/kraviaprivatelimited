import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createOfficeServiceClient } from "@/lib/office/permission-engine";

export type OfficeCompanyIdentity = {
  person_id: string;
  person_code: string;
  person_status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  employment_id: string | null;
  employment_code: string | null;
  employment_type: "EMPLOYEE" | "CONTRACTOR" | "INTERN" | "TRAINEE" | "ADVISOR" | "PROFESSIONAL" | null;
  employment_status: "PLANNED" | "ACTIVE" | "ON_LEAVE" | "ENDED" | null;
  start_date: string | null;
  end_date: string | null;
};

export async function getOfficeCompanyIdentity(userId: string, client?: SupabaseClient): Promise<OfficeCompanyIdentity | null> {
  const admin = client ?? createOfficeServiceClient();
  const { data, error } = await admin.rpc("office_current_company_identity", { p_user: userId });
  if (error) throw new Error("Unable to resolve KRAVIA company identity");
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.person_id !== "string" || typeof row.person_code !== "string") return null;
  return {
    person_id: row.person_id,
    person_code: row.person_code,
    person_status: row.person_status === "INACTIVE" || row.person_status === "ARCHIVED" ? row.person_status : "ACTIVE",
    employment_id: typeof row.employment_id === "string" ? row.employment_id : null,
    employment_code: typeof row.employment_code === "string" ? row.employment_code : null,
    employment_type: typeof row.employment_type === "string" ? row.employment_type as OfficeCompanyIdentity["employment_type"] : null,
    employment_status: typeof row.employment_status === "string" ? row.employment_status as OfficeCompanyIdentity["employment_status"] : null,
    start_date: typeof row.start_date === "string" ? row.start_date : null,
    end_date: typeof row.end_date === "string" ? row.end_date : null,
  };
}
