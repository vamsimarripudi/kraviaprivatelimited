import "server-only";
import {OfficePermissionError,requireOfficeActor,resolveOfficePermission} from "@/lib/office/permission-engine";
import {currentOfficeTrustedDeviceId} from "@/lib/office/device-binding-server";

export class OfficeConnectRetentionError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeConnectRetentionError"}
}
/** Read-only source retention and legal-hold inventory. Never infer or trigger
 * a deletion, legal release, preservation lift or retention timer from UI. */
export async function getOfficeConnectRetention(){
 let current:Awaited<ReturnType<typeof requireOfficeActor>>;
 try{current=await requireOfficeActor()}
 catch(error){if(error instanceof OfficePermissionError)
   throw new OfficeConnectRetentionError(error.status,error.message);throw error;}
 if(current.identity.workspaceStatus!=="ACTIVE")
  throw new OfficeConnectRetentionError(403,"Active Office authority is required");
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const decision=await resolveOfficePermission(current.admin,current.identity,"privacy.retention.read",
  {type:"COMPANY"},device);
 if(!decision.allowed)throw new OfficeConnectRetentionError(403,
  "Canonical privacy retention-read permission is required");
 const [rules,holds]=await Promise.all([
  current.admin.from("office_retention_rules").select(
   "code,record_class,title,jurisdiction,retention_period_text,retention_basis,source_reference,status,reviewed_at,effective_from,effective_to,updated_at"
  ).order("record_class").limit(300),
  current.admin.from("office_legal_holds").select(
   "id,hold_code,title,scope_type,scope_key,status,placed_at,released_at,source_reference,updated_at"
  ).order("placed_at",{ascending:false}).limit(200),
 ]);
 if(rules.error||holds.error)throw new OfficeConnectRetentionError(503,
  "Canonical retention or legal-hold register unavailable");
 const isConnect=(value:unknown)=>/CHAT|CONNECT|COMMUNICAT|MESSAG/i.test(String(value??""));
 return {scope:"CANONICAL_RETENTION_READ" as const,generated_at:new Date().toISOString(),
  rules:(rules.data??[]).filter(row=>isConnect(row.record_class)||isConnect(row.code)),
  legal_holds:(holds.data??[]).filter(row=>isConnect(row.scope_type)),
  completeness:{
   rules_truncated:(rules.data??[]).length>=300,
   holds_truncated:(holds.data??[]).length>=200,
  },
  disclaimer:"Only existing canonical Office retention rules and current legal-hold metadata appear here. Empty Connect-specific registers do not authorize deletion or imply a policy exists. Policy drafts, independent verification and retention execution remain source-governed.",
 };
}
