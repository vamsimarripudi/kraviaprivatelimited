import "server-only";

import { getOfficeCapabilitySnapshot } from "@/lib/office/capability-server";
import { requireOfficeActor } from "@/lib/office/permission-engine";
import { capabilityCanAccessSection } from "@/lib/office/workspace-capabilities";
import { officeSections, financeSections, roleCanAccessSection, roleCanAccessWorkspace, type OfficeRole } from "@/lib/office/workspaces";
import { OFFICE_MANUAL_VERSION, commonManual, manualKey, manualRoles, resolveManualRoleIds } from "@/lib/office/manuals";

export class OfficeManualError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeManualError"}
}
export type ManualReceiptStatus = "PENDING"|"IN_PROGRESS"|"REVIEW_REQUIRED"|"ACKNOWLEDGED";
export type AssignedManual = {
  key:string; id:string;title:string;version:string;status:ManualReceiptStatus;
  opened_at:string|null;acknowledged_at:string|null;
};
export type ManualRoute = {href:string; title:string;group:string;description:string;workspace:"office"|"finance"};

async function resolveSelf() {
  const {admin,identity}=await requireOfficeActor();
  const [profile,employments,positions,capabilities] = await Promise.all([
    admin.from("office_identity_users").select("job_title,primary_department,display_name,status")
      .eq("user_id",identity.userId).maybeSingle(),
    admin.from("office_employment_registry").select("relationship_type,status,start_date")
      .eq("identity_user_id",identity.userId).order("created_at",{ascending:false}).limit(1),
    admin.from("office_employee_functional_positions").select("position_code,department_code,active")
      .eq("employee_user_id",identity.userId).eq("active",true).limit(24),
    getOfficeCapabilitySnapshot(identity),
  ]);
  if(profile.error||employments.error||positions.error||!profile.data)
    throw new OfficeManualError(503,"Verified role information is unavailable");
  const ids=resolveManualRoleIds({
    roles:identity.roles,
    jobTitle:profile.data.job_title||identity.displayRole,
    positionCodes:(positions.data??[]).map(p=>p.position_code),
    relationship:employments.data?.[0]?.relationship_type,
  });
  return {admin,identity,ids,capabilities};
}

export async function getOfficeManualHub() {
  const {admin,identity,ids,capabilities}=await resolveSelf();
  const history=await admin.from("office_manual_receipts")
    .select("manual_key,manual_version,status,opened_at,acknowledged_at")
    .eq("user_id",identity.userId).order("opened_at",{ascending:false}).limit(120);
  if(history.error) throw new OfficeManualError(503,
    "Training receipts are not yet available. Apply the Office manual database migration before activating this feature.");
  const receipts=history.data??[];
  const assigned:Array<{key:string;id:string;title:string}>=[
    {key:manualKey("common"),id:"common",title:"Common employee handbook"},
    ...ids.map(id=>({key:manualKey(id),id,title:manualRoles.find(r=>r.id===id)?.name||"Assigned role guide"})),
  ];
  const manuals:AssignedManual[]=assigned.map(manual=>{
    const matching=receipts.find(row=>row.manual_key===manual.key&&row.manual_version===OFFICE_MANUAL_VERSION);
    const oldAcknowledgement=receipts.some(row=>row.manual_key===manual.key&&row.manual_version!==OFFICE_MANUAL_VERSION&&row.status==="ACKNOWLEDGED");
    return {...manual,version:OFFICE_MANUAL_VERSION,
      status:matching?.status==="ACKNOWLEDGED"?"ACKNOWLEDGED"
        :matching?.status==="IN_PROGRESS"?"IN_PROGRESS"
        :oldAcknowledgement?"REVIEW_REQUIRED":"PENDING",
      opened_at:matching?.opened_at??null,
      acknowledged_at:matching?.acknowledged_at??null};
  });
  const roles=ids.map(id=>manualRoles.find(r=>r.id===id)).filter((item):item is (typeof manualRoles)[number]=>Boolean(item));
  const permissions=capabilities.permissions;
  const routes:ManualRoute[]=[];
  for(const workspace of ["office","finance"] as const){
    if(!roleCanAccessWorkspace(workspace,identity.roles))continue;
    const entries=workspace==="office"?officeSections:financeSections;
    for(const [slug,info] of Object.entries(entries)){
      if(!roleCanAccessSection(info,identity.roles as OfficeRole[]))continue;
      if(!capabilityCanAccessSection(workspace,slug,identity.roles,permissions))continue;
      routes.push({href:"/"+workspace+"/"+slug,title:info.title,group:info.group,description:info.description,workspace});
    }
  }
  return {
    edition:OFFICE_MANUAL_VERSION,
    actor:{display_name:identity.displayName??"",roles:identity.roles,department:identity.department??null},
    manuals,roles,common:commonManual,routes,
    outstanding:manuals.filter(m=>m.status!=="ACKNOWLEDGED").length,
    disclaimer:"Guide receipts record employee reading acknowledgements only; they do not grant authority, establish employment, create signatures, approve payroll or verify statutory compliance.",
  };
}

export async function recordOfficeManual(input:{key:string;action:"OPEN"|"ACKNOWLEDGE"}) {
  const {admin,identity,ids}=await resolveSelf();
  const allowed=new Set([manualKey("common"),...ids.map(manualKey)]);
  if(!allowed.has(input.key))throw new OfficeManualError(403,"This manual is not assigned to your identity");
  const {data,error}=await admin.rpc("office_manual_record_receipt",{
    p_actor:identity.userId,p_key:input.key,p_version:OFFICE_MANUAL_VERSION,p_action:input.action,
  });
  if(error)throw new OfficeManualError(409,error.message||"Manual receipt could not be recorded");
  if(data!=="IN_PROGRESS"&&data!=="ACKNOWLEDGED")throw new OfficeManualError(503,"Unexpected training receipt response");
  return {key:input.key,version:OFFICE_MANUAL_VERSION,status:data};
}
