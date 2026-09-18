import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
  type OfficePermissionDecision,
  type OfficeResourceScope,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeCorporateCardError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeCorporateCardError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type Authority=Actor&{decision:OfficePermissionDecision;department:string|null};

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeCorporateCardError(error.status,error.message);
    throw error;
  }
}
async function authority(code:string):Promise<Authority>{
  const current=await actor();
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const scopes:OfficeResourceScope[]=[
    {type:"COMPANY"},
    ...(current.identity.department?[{type:"DEPARTMENT" as const,key:current.identity.department}]:[]),
    {type:"OWN",key:current.identity.userId,ownerUserId:current.identity.userId},
  ];
  let last:OfficePermissionDecision|undefined;
  for(const scope of scopes){
    const decision=await resolveOfficePermission(current.admin,current.identity,code,scope,device);
    if(decision.allowed)return {...current,decision,department:decision.scopeType==="DEPARTMENT"?(decision.scopeKey||current.identity.department||null):null};
    last=decision;
  }
  throw new OfficeCorporateCardError(403,last?.reason||"Corporate-card permission is required");
}
async function can(code:string){try{await authority(code);return true}catch(error){if(error instanceof OfficeCorporateCardError&&error.status===403)return false;throw error}}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeCorporateCardError(503,error.message||message)}

export async function getCorporateCardOverview(){
  const capabilities={
    read:await can("finance.card.read"),
    manage:await can("finance.card.manage"),
    review:await can("finance.card.review"),
    spend_request:await can("finance.card.spend.request"),
    spend_review:await can("finance.card.spend.review"),
  };
  if(!capabilities.read&&!capabilities.spend_request)throw new OfficeCorporateCardError(403,"Corporate cards are not assigned to your current authority");
  const current=capabilities.read?await authority("finance.card.read"):await authority("finance.card.spend.request");

  let cardQuery=current.admin.from("office_corporate_cards")
    .select("id,card_code,issuer_name,issuer_account_reference,issuer_card_reference,last4,card_type,cardholder_user_id,department_code,cost_center,currency,per_transaction_limit_minor,monthly_limit_minor,allowed_merchant_categories,online_allowed,international_allowed,atm_allowed,valid_through_month,valid_through_year,status,created_by,reviewed_by,reviewed_at,review_note,created_at,updated_at")
    .order("created_at",{ascending:false}).limit(1000);
  if(current.decision.scopeType==="OWN")cardQuery=cardQuery.eq("cardholder_user_id",current.identity.userId);
  else if(current.decision.scopeType==="DEPARTMENT"&&current.department)cardQuery=cardQuery.eq("department_code",current.department);

  const cards=await cardQuery;
  fail(cards.error,"Corporate-card registry is temporarily unavailable");
  const cardIds=(cards.data||[]).map(row=>String(row.id));

  const spends=cardIds.length
    ? await current.admin.from("office_card_spend_requests")
        .select("id,request_code,card_id,requester_user_id,merchant_or_purpose,merchant_category,amount_minor,currency,project_reference,expense_reference,needed_by,status,reviewer_user_id,reviewed_at,review_note,issuer_transaction_reference,receipt_reference,used_at,created_at,updated_at")
        .in("card_id",cardIds).order("created_at",{ascending:false}).limit(2500)
    : {data:[],error:null};
  fail(spends.error,"Corporate-card spend requests are temporarily unavailable");

  const people=(capabilities.manage||capabilities.review||capabilities.spend_review)
    ? (current.department
        ? await current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").eq("primary_department",current.department).order("display_name")
        : await current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name").limit(3000))
    : {data:[],error:null};
  fail(people.error,"Office identities are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles,department:current.identity.department||null},
    scope:{type:current.decision.scopeType||null,key:current.department},
    capabilities,
    cards:cards.data||[],
    spend_requests:spends.data||[],
    people:people.data||[],
    disclaimer:"KRAVIA stores masked corporate-card controls only: issuer references, last four digits, limits and policy. It never stores PAN, CVV, PIN, magnetic-stripe data, cryptograms or issuer payment tokens, and this workflow does not execute card transactions.",
  };
}

export async function createCorporateCard(input:{
  issuer:string;accountReference?:string;cardReference?:string;last4:string;type:string;holderUserId:string;department?:string;costCenter?:string;
  currency:string;perTransactionLimitMinor?:number;monthlyLimitMinor?:number;categories:string[];onlineAllowed:boolean;internationalAllowed:boolean;atmAllowed:boolean;validMonth?:number;validYear?:number;
}){
  const current=await authority("finance.card.manage");
  const {data,error}=await current.admin.rpc("office_corporate_card_create",{
    p_actor:current.identity.userId,p_issuer:input.issuer,p_account_reference:input.accountReference?.trim()||null,p_card_reference:input.cardReference?.trim()||null,
    p_last4:input.last4,p_type:input.type,p_holder:input.holderUserId,p_department:input.department?.trim()||null,p_cost_center:input.costCenter?.trim()||null,
    p_currency:input.currency,p_per_transaction:input.perTransactionLimitMinor??null,p_monthly:input.monthlyLimitMinor??null,p_categories:input.categories,
    p_online:input.onlineAllowed,p_international:input.internationalAllowed,p_atm:input.atmAllowed,p_month:input.validMonth??null,p_year:input.validYear??null,
  });
  if(error||typeof data!=="string")throw new OfficeCorporateCardError(400,error?.message||"Unable to create corporate-card record");
  return {card_id:data};
}
export async function reviewCorporateCard(input:{cardId:string;status:string;perTransactionLimitMinor?:number;monthlyLimitMinor?:number;categories:string[];onlineAllowed:boolean;internationalAllowed:boolean;atmAllowed:boolean;note?:string}){
  const current=await authority("finance.card.review");
  const {data,error}=await current.admin.rpc("office_corporate_card_review",{
    p_actor:current.identity.userId,p_card:input.cardId,p_status:input.status,p_per_transaction:input.perTransactionLimitMinor??null,p_monthly:input.monthlyLimitMinor??null,
    p_categories:input.categories,p_online:input.onlineAllowed,p_international:input.internationalAllowed,p_atm:input.atmAllowed,p_note:input.note?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeCorporateCardError(400,error?.message||"Unable to review corporate card");
  return {status:data};
}
export async function requestCorporateCardSpend(input:{cardId:string;purpose:string;category?:string;amountMinor:number;currency:string;projectReference?:string;expenseReference?:string;neededBy?:string}){
  const current=await authority("finance.card.spend.request");
  const {data,error}=await current.admin.rpc("office_card_spend_request",{
    p_actor:current.identity.userId,p_card:input.cardId,p_purpose:input.purpose,p_category:input.category?.trim()||null,p_amount:input.amountMinor,
    p_currency:input.currency,p_project:input.projectReference?.trim()||null,p_expense:input.expenseReference?.trim()||null,p_needed:input.neededBy??null,
  });
  if(error||typeof data!=="string")throw new OfficeCorporateCardError(400,error?.message||"Unable to request card spend");
  return {spend_request_id:data};
}
export async function reviewCorporateCardSpend(input:{requestId:string;status:string;note?:string}){
  const current=await authority("finance.card.spend.review");
  const {data,error}=await current.admin.rpc("office_card_spend_review",{p_actor:current.identity.userId,p_request:input.requestId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeCorporateCardError(400,error?.message||"Unable to review card spend");
  return {status:data};
}
export async function markCorporateCardSpendUsed(input:{requestId:string;transactionReference:string;receiptReference:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_card_spend_mark_used",{p_actor:current.identity.userId,p_request:input.requestId,p_transaction_reference:input.transactionReference,p_receipt:input.receiptReference});
  if(error||typeof data!=="string")throw new OfficeCorporateCardError(400,error?.message||"Unable to record corporate-card usage");
  return {status:data};
}
