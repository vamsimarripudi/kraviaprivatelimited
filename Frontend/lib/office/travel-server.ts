import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission, type OfficeResourceScope } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeTravelError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeTravelError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeTravelError(error.status,error.message);
    throw error;
  }
}
async function decision(current:Actor,code:string){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const scopes:OfficeResourceScope[]=[
    {type:"COMPANY"},
    ...(current.identity.department?[{type:"DEPARTMENT" as const,key:current.identity.department}]:[]),
    {type:"OWN",key:current.identity.userId},
  ];
  for(const scope of scopes){
    const result=await resolveOfficePermission(current.admin,current.identity,code,scope,device);
    if(result.allowed)return result;
  }
  return null;
}
async function can(code:string){const current=await actor();return Boolean(await decision(current,code))}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeTravelError(503,error.message||message)}

export async function getTravelWorkspace(){
  const current=await actor();
  const read=await decision(current,"travel.read");
  if(!read)throw new OfficeTravelError(403,"Travel workspace is not assigned to your current authority");
  const capabilities={
    request:await can("travel.request"),
    manager_review:await can("travel.manager_review"),
    finance_review:await can("travel.finance_review"),
    book:await can("travel.book"),
    claim_submit:await can("travel.claim.submit"),
    claim_review:await can("travel.claim.review"),
  };
  let travelQuery=current.admin.from("office_travel_requests").select("id,travel_code,requester_user_id,department_code,purpose,destination,starts_on,ends_on,estimated_amount_paise,currency,project_reference,cost_center,status,manager_reviewer,manager_reviewed_at,manager_note,finance_reviewer,finance_reviewed_at,finance_note,booking_reference,booking_evidence_reference,booked_by,booked_at,completed_at,created_at,updated_at").order("created_at",{ascending:false}).limit(600);
  if(read.scopeType==="OWN")travelQuery=travelQuery.eq("requester_user_id",current.identity.userId);
  else if(read.scopeType==="DEPARTMENT"&&read.scopeKey)travelQuery=travelQuery.eq("department_code",read.scopeKey);
  const travels=await travelQuery;fail(travels.error,"Travel records are temporarily unavailable");
  const travelIds=(travels.data||[]).map(row=>String(row.id));
  let claims={data:[],error:null} as {data:any[];error:any};
  if(travelIds.length){
    const q=current.admin.from("office_travel_claims").select("id,claim_code,travel_id,claimant_user_id,expense_date,category,description,amount_paise,currency,receipt_reference,status,reviewer_user_id,reviewed_at,review_note,finance_payment_reference,paid_at,created_at,updated_at").in("travel_id",travelIds).order("created_at",{ascending:false}).limit(1200);
    claims=await q as typeof claims;fail(claims.error,"Travel claims are temporarily unavailable");
  }
  const people=await current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name").limit(2000);
  fail(people.error,"People directory is temporarily unavailable");
  const allowedPeople=read.scopeType==="OWN"?(people.data||[]).filter(row=>row.user_id===current.identity.userId):read.scopeType==="DEPARTMENT"?(people.data||[]).filter(row=>row.primary_department===read.scopeKey):people.data||[];
  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:read.scopeType||null,key:read.scopeKey||null},
    capabilities,
    travels:travels.data||[],
    claims:claims.data||[],
    people:allowedPeople,
    disclaimer:"KRAVIA Travel records approvals, booking evidence and reimbursement evidence. It does not silently execute bank payments or accounting entries.",
  };
}

export async function createTravelRequest(input:{purpose:string;destination:string;startsOn:string;endsOn:string;estimatePaise:number;currency:string;projectReference?:string;costCenter?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_request_create",{p_actor:current.identity.userId,p_purpose:input.purpose,p_destination:input.destination,p_start:input.startsOn,p_end:input.endsOn,p_estimate:input.estimatePaise,p_currency:input.currency,p_project:input.projectReference?.trim()||null,p_cost_center:input.costCenter?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to create travel request");
  return {travel_id:data};
}
export async function managerReviewTravel(input:{travelId:string;decision:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_manager_review",{p_actor:current.identity.userId,p_travel:input.travelId,p_decision:input.decision,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to review travel request");
  return {status:data};
}
export async function financeReviewTravel(input:{travelId:string;decision:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_finance_review",{p_actor:current.identity.userId,p_travel:input.travelId,p_decision:input.decision,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to review travel budget");
  return {status:data};
}
export async function bookTravel(input:{travelId:string;reference:string;evidence:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_book",{p_actor:current.identity.userId,p_travel:input.travelId,p_reference:input.reference,p_evidence:input.evidence});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to record travel booking");
  return {status:data};
}
export async function transitionOwnTravel(input:{travelId:string;status:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_self_transition",{p_actor:current.identity.userId,p_travel:input.travelId,p_status:input.status});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to update travel status");
  return {status:data};
}
export async function submitTravelClaim(input:{travelId:string;expenseDate:string;category:string;description:string;amountPaise:number;currency:string;receiptReference:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_claim_submit",{p_actor:current.identity.userId,p_travel:input.travelId,p_date:input.expenseDate,p_category:input.category,p_description:input.description,p_amount:input.amountPaise,p_currency:input.currency,p_receipt:input.receiptReference});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to submit travel claim");
  return {claim_id:data};
}
export async function reviewTravelClaim(input:{claimId:string;status:string;note?:string;paymentReference?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_travel_claim_review",{p_actor:current.identity.userId,p_claim:input.claimId,p_status:input.status,p_note:input.note?.trim()||null,p_payment_reference:input.paymentReference?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeTravelError(400,error?.message||"Unable to review travel claim");
  return {status:data};
}
