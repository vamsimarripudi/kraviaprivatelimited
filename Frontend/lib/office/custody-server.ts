import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeCustodyError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeCustodyError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeCustodyError(error.status,error.message);
    throw error;
  }
}
async function can(current:Actor,code:string){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return (await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeCustodyError(503,error.message||message)}

export async function getSecureCustodyOverview(){
  const current=await actor();
  const capabilities={
    read:await can(current,"custody.read"),
    manage:await can(current,"custody.manage"),
    checkout:await can(current,"custody.checkout"),
    review:await can(current,"custody.review"),
  };
  if(!Object.values(capabilities).some(Boolean))throw new OfficeCustodyError(403,"Secure custody is not assigned to your current authority");

  const [items,checkouts,people,assets]=await Promise.all([
    current.admin.from("office_secure_custody_items")
      .select("id,custody_code,item_type,title,reference_no,linked_asset_id,document_reference,current_custodian_user_id,storage_location,classification,status,notes,created_by,reviewed_by,reviewed_at,created_at,updated_at")
      .order("created_at",{ascending:false}).limit(1500),
    current.admin.from("office_secure_custody_checkouts")
      .select("id,checkout_code,item_id,checked_out_to_user_id,purpose,related_reference,checked_out_by,checked_out_at,due_back_at,status,returned_at,return_evidence_reference,return_verified_by,return_verified_at,loss_evidence_reference,created_at,updated_at")
      .order("checked_out_at",{ascending:false}).limit(3000),
    capabilities.manage||capabilities.checkout||capabilities.review
      ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
    capabilities.manage
      ? current.admin.from("assets").select("id,asset_no,name,category,serial_no,status").order("asset_no").limit(2000)
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [items,checkouts,people,assets])fail(result.error,"Secure custody records are temporarily unavailable");

  return {
    generated_at:new Date().toISOString(),
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities,
    items:items.data||[],
    checkouts:checkouts.data||[],
    people:people.data||[],
    assets:assets.data||[],
    disclaimer:"Secure custody records physical possession and evidence only. KRAVIA never stores DSC/signing PINs, private keys, token secrets or other cryptographic secret material.",
  };
}

export async function createCustodyItem(input:{type:string;title:string;reference?:string;assetId?:string;documentReference?:string;custodianUserId?:string;location:string;classification:string;notes?:string}){
  const current=await actor();
  if(!await can(current,"custody.manage"))throw new OfficeCustodyError(403,"Secure-custody management permission is required");
  const {data,error}=await current.admin.rpc("office_secure_custody_create",{
    p_actor:current.identity.userId,p_type:input.type,p_title:input.title,p_reference:input.reference?.trim()||null,p_asset:input.assetId??null,
    p_document:input.documentReference?.trim()||null,p_custodian:input.custodianUserId??null,p_location:input.location,
    p_classification:input.classification,p_notes:input.notes?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeCustodyError(400,error?.message||"Unable to create custody item");
  return {item_id:data};
}
export async function checkoutCustodyItem(input:{itemId:string;toUserId:string;purpose:string;relatedReference?:string;dueBackAt?:string}){
  const current=await actor();
  if(!await can(current,"custody.checkout"))throw new OfficeCustodyError(403,"Secure-item checkout permission is required");
  const {data,error}=await current.admin.rpc("office_secure_custody_checkout",{p_actor:current.identity.userId,p_item:input.itemId,p_to:input.toUserId,p_purpose:input.purpose,p_related:input.relatedReference?.trim()||null,p_due:input.dueBackAt??null});
  if(error||typeof data!=="string")throw new OfficeCustodyError(400,error?.message||"Unable to checkout secure item");
  return {checkout_id:data};
}
export async function returnCustodyItem(input:{checkoutId:string;evidence:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_secure_custody_return",{p_actor:current.identity.userId,p_checkout:input.checkoutId,p_evidence:input.evidence});
  if(error||typeof data!=="string")throw new OfficeCustodyError(400,error?.message||"Unable to record secure-item return");
  return {status:data};
}
export async function verifyCustodyReturn(input:{checkoutId:string;evidence:string}){
  const current=await actor();
  if(!await can(current,"custody.review"))throw new OfficeCustodyError(403,"Independent custody review permission is required");
  const {data,error}=await current.admin.rpc("office_secure_custody_verify_return",{p_actor:current.identity.userId,p_checkout:input.checkoutId,p_evidence:input.evidence});
  if(error||data!==true)throw new OfficeCustodyError(400,error?.message||"Unable to verify secure-item return");
  return {verified:true};
}
export async function markCustodyLost(input:{checkoutId:string;evidence:string;note?:string}){
  const current=await actor();
  if(!await can(current,"custody.review"))throw new OfficeCustodyError(403,"Independent custody review permission is required");
  const {data,error}=await current.admin.rpc("office_secure_custody_mark_lost",{p_actor:current.identity.userId,p_checkout:input.checkoutId,p_evidence:input.evidence,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeCustodyError(400,error?.message||"Unable to mark secure item lost");
  return {status:data};
}
