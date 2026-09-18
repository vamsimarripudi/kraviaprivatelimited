import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeContractsError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeContractsError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeContractsError(error.status,error.message);
    throw error;
  }
}
async function can(current:Actor,code:string){
  const deviceId=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return (await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},deviceId)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeContractsError(503,error.message||message)}

export async function getContractOperationsOverview(){
  const current=await actor();
  const [obligationRead,obligationManage,obligationReview,contractDraft,contractReview,contractExecute]=await Promise.all([
    can(current,"legal.obligation.read"),can(current,"legal.obligation.manage"),can(current,"legal.obligation.review"),
    can(current,"legal.contract.draft"),can(current,"legal.contract.review"),can(current,"legal.contract.execute"),
  ]);
  if(!obligationRead&&!obligationManage&&!obligationReview&&!contractDraft&&!contractReview&&!contractExecute){
    throw new OfficeContractsError(403,"Contract operations are not assigned to your current authority");
  }

  const [contractsResult,obligationsResult,peopleResult]=await Promise.all([
    current.admin.from("contracts")
      .select("id,contract_no,contract_type,counterparty_name,product_codes_json,effective_date,expiry_date,notice_days,value_paise,status,document_ref,owner,created_at")
      .order("created_at",{ascending:false}).limit(500),
    obligationRead||obligationManage||obligationReview
      ? current.admin.from("office_contract_obligations")
          .select("id,obligation_code,contract_id,obligation_type,title,description,owner_user_id,cadence,next_due_at,evidence_required,status,source_clause_reference,created_by,reviewed_by,reviewed_at,created_at,updated_at")
          .order("next_due_at",{ascending:true,nullsFirst:false}).limit(1500)
      : Promise.resolve({data:[],error:null}),
    obligationManage||obligationReview
      ? current.admin.from("office_identity_users")
          .select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
  ]);
  fail(contractsResult.error,"Contract registry is temporarily unavailable");
  fail(obligationsResult.error,"Contract obligations are temporarily unavailable");
  fail(peopleResult.error,"Office identities are temporarily unavailable");

  const obligationIds=(obligationsResult.data||[]).map(row=>String(row.id));
  const events=obligationIds.length
    ? await current.admin.from("office_contract_obligation_events")
        .select("id,obligation_id,actor_user_id,event_type,due_at,evidence_reference,note,metadata,created_at")
        .in("obligation_id",obligationIds).order("created_at",{ascending:false}).limit(2500)
    : {data:[],error:null};
  fail(events.error,"Contract obligation history is temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities:{
      obligation_read:obligationRead,
      obligation_manage:obligationManage,
      obligation_review:obligationReview,
      contract_draft:contractDraft,
      contract_review:contractReview,
      contract_execute:contractExecute,
    },
    contracts:contractsResult.data||[],
    obligations:obligationsResult.data||[],
    people:peopleResult.data||[],
    events:events.data||[],
    disclaimer:"Contract records remain canonical in the existing backend-owned registry. KRAVIA Office tracks operational obligations, evidence, recurrence and independent review without changing contract ownership or fabricating legal interpretation.",
  };
}

export async function createContractObligation(input:{
  contractId:string;type:string;title:string;description:string;ownerUserId:string;cadence:string;dueAt?:string;
  evidenceRequired:boolean;clauseReference?:string;
}){
  const current=await actor();
  if(!await can(current,"legal.obligation.manage"))throw new OfficeContractsError(403,"Contract obligation management permission is required");
  const {data,error}=await current.admin.rpc("office_contract_obligation_create",{
    p_actor:current.identity.userId,p_contract:input.contractId,p_type:input.type,p_title:input.title,
    p_description:input.description,p_owner:input.ownerUserId,p_cadence:input.cadence,p_due:input.dueAt??null,
    p_evidence_required:input.evidenceRequired,p_clause:input.clauseReference?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeContractsError(400,error?.message||"Unable to create contract obligation");
  return {obligation_id:data};
}

export async function satisfyContractObligation(input:{obligationId:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_contract_obligation_satisfy",{
    p_actor:current.identity.userId,p_obligation:input.obligationId,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeContractsError(400,error?.message||"Unable to satisfy contract obligation");
  return {status:data};
}

export async function reviewContractObligation(input:{obligationId:string;action:string;evidence?:string;note?:string}){
  const current=await actor();
  if(!await can(current,"legal.obligation.review"))throw new OfficeContractsError(403,"Independent contract obligation review permission is required");
  const {data,error}=await current.admin.rpc("office_contract_obligation_review",{
    p_actor:current.identity.userId,p_obligation:input.obligationId,p_action:input.action,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeContractsError(400,error?.message||"Unable to review contract obligation");
  return {status:data};
}
