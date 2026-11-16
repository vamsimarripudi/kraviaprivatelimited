import "server-only";
import {dispatchOfficeSupportNotice} from "@/lib/office/notification-dispatch-server";



import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";

export class OfficeSupportError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OfficeSupportError";
  }
}

type Authority = Awaited<ReturnType<typeof requireOfficeActor>> & {
  decision: OfficePermissionDecision;
  ownerIds: string[] | null;
};

type CaseInput = {
  ownerUserId: string;
  customerId?: string;
  productId?: string;
  subject: string;
  description: string;
  category?: string;
  source?: "EMAIL" | "PHONE" | "WEB" | "INTERNAL" | "OTHER";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt?: string;
};

async function actor() {
  try {
    return await requireOfficeActor();
  } catch (error) {
    if (error instanceof OfficePermissionError) throw new OfficeSupportError(error.status, error.message);
    throw error;
  }
}

async function permission(
  permissionCode: string,
  verifiedActor?: Awaited<ReturnType<typeof actor>>,
): Promise<Authority> {
  const currentActor = verifiedActor ?? await actor();
  const candidates: OfficeResourceScope[] = [
    ...(currentActor.identity.department ? [{ type: "DEPARTMENT" as const, key: currentActor.identity.department }] : []),
    { type: "OWN", ownerUserId: currentActor.identity.userId },
    { type: "COMPANY" },
  ];
  let decision: OfficePermissionDecision | undefined;
  for (const resource of candidates) {
    const current = await resolveOfficePermission(currentActor.admin, currentActor.identity, permissionCode, resource);
    if (current.allowed) { decision = current; break; }
    decision = current;
  }
  if (!decision?.allowed) throw new OfficeSupportError(403, decision?.reason ?? "Support permission is required");

  let ownerIds: string[] | null = null;
  if (decision.source !== "OWNER" && decision.scopeType === "OWN") {
    ownerIds = [currentActor.identity.userId];
  } else if (decision.source !== "OWNER" && decision.scopeType === "DEPARTMENT") {
    const department = decision.scopeKey || currentActor.identity.department;
    if (!department) ownerIds = [currentActor.identity.userId];
    else {
      const { data, error } = await currentActor.admin.from("office_identity_users").select("user_id").eq("status", "ACTIVE").eq("primary_department", department);
      if (error) throw new OfficeSupportError(503, "Unable to resolve support department scope");
      ownerIds = (data ?? []).map((row) => String(row.user_id));
    }
  }
  return { ...currentActor, decision, ownerIds };
}

function applyOwnerScope<T>(query: T, ownerIds: string[] | null) {
  if (!ownerIds) return query;
  return (query as T & { in: (column: string, values: string[]) => T }).in("owner_user_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
}

function ownerAllowed(ownerIds: string[] | null, ownerUserId: string) {
  return !ownerIds || ownerIds.includes(ownerUserId);
}

async function writableCase(id: string) {
  const write = await permission("support.case.manage");
  const { data, error } = await write.admin.from("office_support_cases").select("id,owner_user_id,customer_id,product_id,case_code,subject,status").eq("id", id).maybeSingle();
  if (error || !data) throw new OfficeSupportError(404, "Support case not found");
  if (!ownerAllowed(write.ownerIds, String(data.owner_user_id))) throw new OfficeSupportError(403, "Support case is outside your assigned scope");
  return { ...write, supportCase: data };
}

export async function getOfficeSupportOverview() {
  const verifiedActor = await actor();
  const read = await permission("support.case.read", verifiedActor);
  let casesQuery = read.admin.from("office_support_cases").select("id,case_code,customer_id,product_id,subject,description,category,source,priority,status,owner_user_id,created_by,resolution,due_at,resolved_at,closed_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(400);
  casesQuery = applyOwnerScope(casesQuery, read.ownerIds);
  const { data: cases, error: casesError } = await casesQuery;
  if (casesError) throw new OfficeSupportError(503, "Support cases are temporarily unavailable");
  const rows = cases ?? [];
  const ids = rows.map((row) => String(row.id));
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter(Boolean) as string[]));
  const productIds = Array.from(new Set(rows.map((row) => row.product_id).filter(Boolean) as string[]));

  // Linked labels are sourced from the same canonical database, not via
  // a second Railway authentication and network hop. Queries are bounded
  // to customer/product IDs already attached to authorised cases.
  async function referenceRows(table: "customers" | "products", ids: string[]) {
    const empty=[] as Array<Record<string,unknown>>;
    if (!ids.length) return {data:empty,error:null as {message:string}|null};
    const chunks=Array.from({length:Math.ceil(ids.length/60)},(_,index)=>ids.slice(index*60,(index+1)*60));
    const results=await Promise.all(chunks.map(async batch=>{
      if(table==="customers"){
        const response=await read.admin.from("customers")
          .select("id,display_name,legal_name").in("id",batch);
        const data:Array<Record<string,unknown>>=(response.data??[]).map(row=>({
          id:row.id,display_name:row.display_name,legal_name:row.legal_name,
        }));
        return {data,error:response.error};
      }
      const response=await read.admin.from("products")
        .select("id,code,name").in("id",batch);
      const data:Array<Record<string,unknown>>=(response.data??[]).map(row=>({
        id:row.id,code:row.code,name:row.name,
      }));
      return {data,error:response.error};
    }));
    const failure=results.find(item=>item.error)?.error;
    return {
      data:failure?empty:results.flatMap(item=>item.data),
      error:failure?{message:"Canonical reference records unavailable"}:null,
    };
  }
  const [eventsResult, customersResult, productsResult, ownersResult] = await Promise.all([
    ids.length ? read.admin.from("office_support_case_events").select("id,case_id,actor_user_id,event_type,previous_status,new_status,note,created_at").in("case_id", ids).order("created_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [], error: null }),
    referenceRows("customers",customerIds),
    referenceRows("products",productIds),
    (() => {
      let query = read.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status", "ACTIVE").order("display_name");
      if (read.ownerIds) query = query.in("user_id", read.ownerIds.length ? read.ownerIds : [read.identity.userId]);
      return query;
    })(),
  ]);
  // A temporary reference-catalog problem must not hide genuine support
  // cases or prevent audited case transitions. No substitute data is created.
  if (eventsResult.error || ownersResult.error)
    throw new OfficeSupportError(503, "Support case history or assigned owners temporarily unavailable");
  const referenceStatus = customersResult.error || productsResult.error ? "DEGRADED" : "READY";

  // Reuse the authenticated actor and check independent capabilities together.
  // A denied permission returns false; backend failures still surface as errors.
  const [canManage,canRefund] = await Promise.all([
    permission("support.case.manage",verifiedActor).then(()=>true).catch(error=>{
      if(error instanceof OfficeSupportError && error.status===403)return false;
      throw error;
    }),
    permission("customer.refund.request",verifiedActor).then(()=>true).catch(error=>{
      if(error instanceof OfficeSupportError && error.status===403)return false;
      throw error;
    }),
  ]);

  const eventsByCase = new Map<string, unknown[]>();
  for (const event of eventsResult.data ?? []) {
    const key = String(event.case_id);
    const current = eventsByCase.get(key) ?? [];
    current.push(event);
    eventsByCase.set(key, current);
  }

  return {
    actor: { user_id: read.identity.userId, roles: read.identity.roles, department: read.identity.department ?? null },
    scope: { source: read.decision.source ?? null, type: read.decision.scopeType ?? null, key: read.decision.scopeKey ?? null },
    can_manage: canManage,
    can_request_refund: canRefund,
    reference_status: referenceStatus,
    owners: ownersResult.data ?? [],
    customers: customersResult.data ?? [],
    products: productsResult.data ?? [],
    cases: rows.map((row) => ({ ...row, events: eventsByCase.get(String(row.id)) ?? [] })),
    disclaimer: "Support resolution and refund authority are separate. A support case can request a refund workflow but cannot execute money movement.",
  };
}

export async function createOfficeSupportCase(input: CaseInput) {
  const write = await permission("support.case.manage");
  if (!ownerAllowed(write.ownerIds, input.ownerUserId)) throw new OfficeSupportError(403, "Support owner is outside your assigned scope");
  const { data, error } = await write.admin.rpc("office_support_create_case", {
    p_actor: write.identity.userId,
    p_owner: input.ownerUserId,
    p_customer: input.customerId ?? null,
    p_product: input.productId ?? null,
    p_subject: input.subject,
    p_description: input.description,
    p_category: input.category?.trim() || "GENERAL",
    p_source: input.source ?? "INTERNAL",
    p_priority: input.priority ?? "NORMAL",
    p_due_at: input.dueAt ?? null,
  });
  if (error || typeof data !== "string") throw new OfficeSupportError(400, error?.message ?? "Unable to create support case");
  await dispatchOfficeSupportNotice(write.admin,data,write.identity.userId,"CREATED").catch(()=>{});
  return { case_id: data };
}

export async function transitionOfficeSupportCase(input: { caseId: string; status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED"; note?: string }) {
  const write = await writableCase(input.caseId);
  const { data, error } = await write.admin.rpc("office_support_transition_case", {
    p_actor: write.identity.userId,
    p_case: input.caseId,
    p_status: input.status,
    p_note: input.note?.trim() || null,
  });
  if (error || typeof data !== "string") throw new OfficeSupportError(400, error?.message ?? "Unable to transition support case");
  await dispatchOfficeSupportNotice(write.admin,input.caseId,write.identity.userId,data).catch(()=>{});
  return { status: data };
}

/** Audited support-team case conversation, independent of status/refund changes. */
export async function replyOfficeSupportCase(input:{caseId:string;body:string}){
  const write=await writableCase(input.caseId);
  const body=input.body.trim();
  if(body.length<1||body.length>4000)
    throw new OfficeSupportError(400,"Support reply must contain 1–4000 characters");
  if(write.supportCase.status==="CLOSED")
    throw new OfficeSupportError(409,"Closed support cases are read-only");
  const {data:event,error}=await write.admin.from("office_support_case_events").insert({
    case_id:input.caseId,actor_user_id:write.identity.userId,
    event_type:"CASE_REPLY",note:body,
    previous_status:write.supportCase.status,new_status:write.supportCase.status,
  }).select("id").single();
  if(error||!event)throw new OfficeSupportError(503,"Support reply was not recorded");
  await dispatchOfficeSupportNotice(write.admin,input.caseId,write.identity.userId,
    "REPLY_"+String(event.id)).catch(()=>{});
  return {reply_id:String(event.id)};
}

export async function requestOfficeSupportRefund(input: { caseId: string; amountMinor: number; currency: string; reason: string }) {
  const write = await writableCase(input.caseId);
  const supportCase = write.supportCase;
  const ownerId = String(supportCase.owner_user_id);
  const ownerDepartmentResult = await write.admin.from("office_identity_users").select("primary_department").eq("user_id", ownerId).maybeSingle();
  const ownerDepartment = ownerDepartmentResult.data?.primary_department ? String(ownerDepartmentResult.data.primary_department) : null;
  const candidates: OfficeResourceScope[] = [
    ...(ownerDepartment ? [{ type: "DEPARTMENT" as const, key: ownerDepartment }] : []),
    { type: "OWN", ownerUserId: ownerId },
    { type: "COMPANY" },
  ];
  let allowed = false;
  for (const resource of candidates) {
    const decision = await resolveOfficePermission(write.admin, write.identity, "customer.refund.request", resource);
    if (decision.allowed) { allowed = true; break; }
  }
  if (!allowed) throw new OfficeSupportError(403, "Customer refund request permission is required");

  const { data, error } = await write.admin.rpc("office_create_request", {
    p_requester: write.identity.userId,
    p_request_type: "CUSTOMER_REFUND",
    p_title: `Refund review · ${String(supportCase.case_code)}`,
    p_description: input.reason.trim(),
    p_payload: {
      support_case_id: input.caseId,
      customer_id: supportCase.customer_id ?? null,
      product_id: supportCase.product_id ?? null,
      amount_minor: input.amountMinor,
      currency: input.currency.toUpperCase(),
    },
    p_priority: "HIGH",
    p_target_user: null,
    p_resource_type: "SUPPORT_CASE",
    p_resource_key: input.caseId,
  });
  if (error || typeof data !== "string") throw new OfficeSupportError(400, error?.message ?? "Unable to create refund approval request");
  return { request_id: data };
}
