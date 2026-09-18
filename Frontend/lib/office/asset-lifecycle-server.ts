import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";
import { readOfficeRuntimeResult } from "@/lib/office/runtime-read-server";

export class OfficeAssetError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeAssetError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeAssetError(error.status,error.message);
    throw error;
  }
}
async function can(current:Actor,code:string,scope:"COMPANY"|"OWN"="COMPANY"){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  const resource=scope==="OWN"?{type:"OWN" as const,key:current.identity.userId,ownerUserId:current.identity.userId}:{type:"COMPANY" as const};
  return (await resolveOfficePermission(current.admin,current.identity,code,resource,device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeAssetError(503,error.message||message)}

export async function getAssetLifecycleOverview(){
  const current=await actor();
  const capabilities={
    read_company:await can(current,"operations.asset.read"),
    read_own:await can(current,"operations.asset.read","OWN"),
    manage:await can(current,"operations.asset.manage"),
    wipe:await can(current,"operations.asset.wipe"),
    dispose:await can(current,"operations.asset.dispose"),
  };
  if(!capabilities.read_company&&!capabilities.read_own&&!capabilities.manage&&!capabilities.wipe&&!capabilities.dispose){
    throw new OfficeAssetError(403,"Asset lifecycle is not assigned to your current authority");
  }

  let lifecycleQuery=current.admin.from("office_asset_lifecycle")
    .select("asset_id,device_id,custodian_user_id,supplier_name,warranty_expires_on,condition,lifecycle_status,security_wipe_required,wipe_evidence_reference,wipe_verified_by,wipe_verified_at,maintenance_due_on,disposal_evidence_reference,disposal_approved_by,disposal_approved_at,updated_by,created_at,updated_at")
    .order("updated_at",{ascending:false}).limit(1000);
  if(!capabilities.read_company&&capabilities.read_own)lifecycleQuery=lifecycleQuery.eq("custodian_user_id",current.identity.userId);
  const lifecycle=await lifecycleQuery;
  fail(lifecycle.error,"Asset lifecycle data is temporarily unavailable");
  const assetIds=(lifecycle.data||[]).map(row=>String(row.asset_id));

  if(!capabilities.read_company&&capabilities.read_own&&!assetIds.length)return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities,assets:[],lifecycle:[],events:[],people:[],devices:[],
    disclaimer:"Asset lifecycle stores operational metadata and evidence only. Device secrets, recovery keys and wipe credentials are never stored here.",
  };
  const assets=await readOfficeRuntimeResult<Array<Record<string,unknown>>>("assets");
  fail(assets.error,"Asset registry is temporarily unavailable");
  const allAssets=(assets.data||[]).slice(0,1000).sort((left,right)=>String(left.asset_no||"").localeCompare(String(right.asset_no||"")));
  const visibleAssets=capabilities.read_company?allAssets:allAssets.filter(row=>assetIds.includes(String(row.id)));
  const visibleIds=visibleAssets.map(row=>String(row.id));
  const [events,people,devices]=await Promise.all([
    visibleIds.length
      ? current.admin.from("office_asset_events")
          .select("id,event_code,asset_id,actor_user_id,event_type,previous_status,new_status,evidence_reference,note,metadata,created_at")
          .in("asset_id",visibleIds).order("created_at",{ascending:false}).limit(3000)
      : Promise.resolve({data:[],error:null}),
    capabilities.manage||capabilities.wipe||capabilities.dispose
      ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
    capabilities.manage
      ? current.admin.from("office_device_registry").select("id,user_id,device_label,device_kind,platform,trust_state,company_managed,revoked_at").eq("company_managed",true).is("revoked_at",null).order("device_label")
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [events,people,devices])fail(result.error,"Asset lifecycle support data is temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities,
    assets:visibleAssets,
    lifecycle:lifecycle.data||[],
    events:events.data||[],
    people:people.data||[],
    devices:devices.data||[],
    disclaimer:"Asset lifecycle stores operational metadata and evidence only. Device passwords, recovery keys, wipe credentials and private secrets are never stored here. Disposal and wipe are evidence records; KRAVIA does not itself erase hardware.",
  };
}

export async function registerAssetLifecycle(input:{assetId:string;deviceId?:string;supplier?:string;warranty?:string;condition:string;wipeRequired:boolean;maintenanceDue?:string}){
  const current=await actor();
  if(!await can(current,"operations.asset.manage"))throw new OfficeAssetError(403,"Asset management permission is required");
  const {data,error}=await current.admin.rpc("office_asset_lifecycle_register",{p_actor:current.identity.userId,p_asset:input.assetId,p_device:input.deviceId??null,p_supplier:input.supplier?.trim()||null,p_warranty:input.warranty??null,p_condition:input.condition,p_wipe_required:input.wipeRequired,p_maintenance_due:input.maintenanceDue??null});
  if(error||data!==true)throw new OfficeAssetError(400,error?.message||"Unable to register asset lifecycle");
  return {registered:true};
}
export async function assignAsset(input:{assetId:string;userId:string;location?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_asset_assign",{p_actor:current.identity.userId,p_asset:input.assetId,p_user:input.userId,p_location:input.location?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeAssetError(400,error?.message||"Unable to assign asset");
  return {status:data};
}
export async function transitionAsset(input:{assetId:string;action:string;condition?:string;evidence?:string;note?:string}){
  const current=await actor();
  const {data,error}=await current.admin.rpc("office_asset_transition",{p_actor:current.identity.userId,p_asset:input.assetId,p_action:input.action,p_condition:input.condition?.trim()||null,p_evidence:input.evidence?.trim()||null,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeAssetError(400,error?.message||"Unable to transition asset");
  return {status:data};
}
export async function verifyAssetWipe(input:{assetId:string;evidence:string;note?:string}){
  const current=await actor();
  if(!await can(current,"operations.asset.wipe"))throw new OfficeAssetError(403,"Secure-wipe verification permission is required");
  const {data,error}=await current.admin.rpc("office_asset_verify_wipe",{p_actor:current.identity.userId,p_asset:input.assetId,p_evidence:input.evidence,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeAssetError(400,error?.message||"Unable to verify secure wipe");
  return {status:data};
}
export async function disposeAsset(input:{assetId:string;evidence:string;note?:string}){
  const current=await actor();
  if(!await can(current,"operations.asset.dispose"))throw new OfficeAssetError(403,"Independent asset-disposal approval permission is required");
  const {data,error}=await current.admin.rpc("office_asset_dispose",{p_actor:current.identity.userId,p_asset:input.assetId,p_evidence:input.evidence,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeAssetError(400,error?.message||"Unable to dispose asset");
  return {status:data};
}
