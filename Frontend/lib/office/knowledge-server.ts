import "server-only";

import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeKnowledgeError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeKnowledgeError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
async function actor():Promise<Actor>{try{return await requireOfficeActor()}catch(error){if(error instanceof OfficePermissionError)throw new OfficeKnowledgeError(error.status,error.message);throw error}}
async function can(current:Actor,code:string,scope:"COMPANY"|"DEPARTMENT"="COMPANY",key?:string){
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 return (await resolveOfficePermission(current.admin,current.identity,code,{type:scope,key},device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeKnowledgeError(503,error.message||message)}
function inAudience(row:{audience_type:string;audience_key?:string|null},department:string|null,roles:string[]){
 if(row.audience_type==="COMPANY")return true;
 if(row.audience_type==="DEPARTMENT")return Boolean(department&&row.audience_key&&department.toUpperCase()===row.audience_key.toUpperCase());
 if(row.audience_type==="ROLE")return Boolean(row.audience_key&&roles.includes(row.audience_key));
 return false;
}

export async function getKnowledgeHub(){
 const current=await actor();
 const department=current.identity.department||null;
 const caps={
  policy_read:await can(current,"policy.read"),
  policy_manage:await can(current,"policy.manage"),
  policy_publish:await can(current,"policy.publish"),
  announcement_read:await can(current,"announcement.read"),
  announcement_manage:await can(current,"announcement.manage"),
  knowledge_read:await can(current,"knowledge.read"),
  knowledge_manage:await can(current,"knowledge.manage")||Boolean(department&&await can(current,"knowledge.manage","DEPARTMENT",department)),
  knowledge_publish:await can(current,"knowledge.publish")||Boolean(department&&await can(current,"knowledge.publish","DEPARTMENT",department)),
 };
 if(!caps.policy_read&&!caps.announcement_read&&!caps.knowledge_read)throw new OfficeKnowledgeError(403,"Knowledge Hub is not assigned to your current authority");

 const [policies,policyVersions,acks,announcements,receipts,articles,articleVersions,people]=await Promise.all([
  caps.policy_read?current.admin.from("office_policies").select("id,policy_code,title,category,audience_type,audience_key,acknowledgement_required,owner_user_id,current_version,status,created_by,created_at,updated_at").order("updated_at",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
  caps.policy_read?current.admin.from("office_policy_versions").select("id,policy_id,version,content_text,effective_on,change_summary,status,created_by,published_by,published_at,content_sha256,created_at").order("version",{ascending:false}).limit(2000):Promise.resolve({data:[],error:null}),
  caps.policy_read?current.admin.from("office_policy_acknowledgements").select("id,policy_version_id,user_id,acknowledged_at,source").eq("user_id",current.identity.userId).limit(1000):Promise.resolve({data:[],error:null}),
  caps.announcement_read?current.admin.from("office_announcements").select("id,announcement_code,title,body_text,announcement_type,audience_type,audience_key,requires_ack,priority,status,published_at,expires_at,created_by,published_by,created_at,updated_at").order("published_at",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
  caps.announcement_read?current.admin.from("office_announcement_receipts").select("id,announcement_id,user_id,read_at,acknowledged_at").eq("user_id",current.identity.userId).limit(1000):Promise.resolve({data:[],error:null}),
  caps.knowledge_read?current.admin.from("office_knowledge_articles").select("id,article_code,title,category,audience_type,audience_key,owner_user_id,current_version,status,created_by,created_at,updated_at").order("updated_at",{ascending:false}).limit(800):Promise.resolve({data:[],error:null}),
  caps.knowledge_read?current.admin.from("office_knowledge_versions").select("id,article_id,version,content_text,change_summary,status,created_by,published_by,published_at,content_sha256,created_at").order("version",{ascending:false}).limit(3000):Promise.resolve({data:[],error:null}),
  (caps.policy_manage||caps.policy_publish||caps.announcement_manage||caps.knowledge_manage||caps.knowledge_publish)?current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name"):Promise.resolve({data:[],error:null}),
 ]);
 for(const result of [policies,policyVersions,acks,announcements,receipts,articles,articleVersions,people])fail(result.error,"Knowledge Hub records are temporarily unavailable");

 const policyRows=(policies.data||[]).filter(row=>(caps.policy_manage||caps.policy_publish)|| (row.status==="PUBLISHED"&&inAudience(row,department,current.identity.roles)));
 const policyIds=new Set(policyRows.map(row=>String(row.id)));
 const versions=(policyVersions.data||[]).filter(row=>policyIds.has(String(row.policy_id))&&((caps.policy_manage||caps.policy_publish)||row.status==="PUBLISHED"));
 const now=Date.now();
 const announcementRows=(announcements.data||[]).filter(row=>(caps.announcement_manage)||(
  row.status==="PUBLISHED"&&(!row.expires_at||new Date(row.expires_at).getTime()>now)&&inAudience(row,department,current.identity.roles)
 ));
 const articleRows=(articles.data||[]).filter(row=>(caps.knowledge_manage||caps.knowledge_publish)||(row.status==="PUBLISHED"&&inAudience(row,department,current.identity.roles)));
 const articleIds=new Set(articleRows.map(row=>String(row.id)));
 const knowledgeVersions=(articleVersions.data||[]).filter(row=>articleIds.has(String(row.article_id))&&((caps.knowledge_manage||caps.knowledge_publish)||row.status==="PUBLISHED"));

 return {
  actor:{user_id:current.identity.userId,roles:current.identity.roles,department},
  capabilities:caps,
  policies:policyRows,
  policy_versions:versions,
  policy_acknowledgements:acks.data||[],
  announcements:announcementRows,
  announcement_receipts:receipts.data||[],
  articles:articleRows,
  article_versions:knowledgeVersions,
  people:people.data||[],
  disclaimer:"Published policy and knowledge versions are immutable evidence. KRAVIA records acknowledgement/read state but does not infer comprehension or legal consent beyond the recorded action.",
 };
}

export async function createPolicy(input:{title:string;category:string;audienceType:string;audienceKey?:string;ack:boolean;ownerUserId:string;content:string;effectiveOn?:string;changeSummary?:string}){
 const current=await actor(); if(!await can(current,"policy.manage"))throw new OfficeKnowledgeError(403,"Policy management permission is required");
 const {data,error}=await current.admin.rpc("office_policy_create",{p_actor:current.identity.userId,p_title:input.title,p_category:input.category,p_audience_type:input.audienceType,p_audience_key:input.audienceKey?.trim()||null,p_ack:input.ack,p_owner:input.ownerUserId,p_content:input.content,p_effective:input.effectiveOn??null,p_change_summary:input.changeSummary?.trim()||null});
 if(error||typeof data!=="string")throw new OfficeKnowledgeError(400,error?.message||"Unable to create policy"); return {policy_id:data};
}
export async function newPolicyVersion(input:{policyId:string;content:string;effectiveOn?:string;summary?:string}){
 const current=await actor(); if(!await can(current,"policy.manage"))throw new OfficeKnowledgeError(403,"Policy management permission is required");
 const {data,error}=await current.admin.rpc("office_policy_new_version",{p_actor:current.identity.userId,p_policy:input.policyId,p_content:input.content,p_effective:input.effectiveOn??null,p_summary:input.summary?.trim()||null});
 if(error||typeof data!=="string")throw new OfficeKnowledgeError(400,error?.message||"Unable to create policy version"); return {version_id:data};
}
export async function publishPolicy(versionId:string){
 const current=await actor(); if(!await can(current,"policy.publish"))throw new OfficeKnowledgeError(403,"Policy publishing permission is required");
 const {data,error}=await current.admin.rpc("office_policy_publish",{p_actor:current.identity.userId,p_version:versionId});
 if(error||data!==true)throw new OfficeKnowledgeError(400,error?.message||"Unable to publish policy"); return {published:true};
}
export async function acknowledgePolicy(versionId:string){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_policy_acknowledge",{p_actor:current.identity.userId,p_version:versionId});
 if(error||data!==true)throw new OfficeKnowledgeError(400,error?.message||"Unable to acknowledge policy"); return {acknowledged:true};
}
export async function createAnnouncement(input:{title:string;body:string;type:string;audienceType:string;audienceKey?:string;requiresAck:boolean;priority:string;expiresAt?:string}){
 const current=await actor(); if(!await can(current,"announcement.manage"))throw new OfficeKnowledgeError(403,"Announcement management permission is required");
 const {data,error}=await current.admin.rpc("office_announcement_create",{p_actor:current.identity.userId,p_title:input.title,p_body:input.body,p_type:input.type,p_audience_type:input.audienceType,p_audience_key:input.audienceKey?.trim()||null,p_ack:input.requiresAck,p_priority:input.priority,p_expires:input.expiresAt??null});
 if(error||typeof data!=="string")throw new OfficeKnowledgeError(400,error?.message||"Unable to publish announcement"); return {announcement_id:data};
}
export async function receiptAnnouncement(announcementId:string,ack:boolean){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_announcement_receipt",{p_actor:current.identity.userId,p_announcement:announcementId,p_ack:ack});
 if(error||data!==true)throw new OfficeKnowledgeError(400,error?.message||"Unable to record announcement receipt"); return {recorded:true};
}
export async function createKnowledge(input:{title:string;category:string;audienceType:string;audienceKey?:string;ownerUserId:string;content:string;summary?:string}){
 const current=await actor();
 const allowed=await can(current,"knowledge.manage")||Boolean(current.identity.department&&await can(current,"knowledge.manage","DEPARTMENT",current.identity.department));
 if(!allowed)throw new OfficeKnowledgeError(403,"Knowledge management permission is required");
 const {data,error}=await current.admin.rpc("office_knowledge_create",{p_actor:current.identity.userId,p_title:input.title,p_category:input.category,p_audience_type:input.audienceType,p_audience_key:input.audienceKey?.trim()||null,p_owner:input.ownerUserId,p_content:input.content,p_summary:input.summary?.trim()||null});
 if(error||typeof data!=="string")throw new OfficeKnowledgeError(400,error?.message||"Unable to create knowledge article"); return {article_id:data};
}
export async function newKnowledgeVersion(input:{articleId:string;content:string;summary?:string}){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_knowledge_new_version",{p_actor:current.identity.userId,p_article:input.articleId,p_content:input.content,p_summary:input.summary?.trim()||null});
 if(error||typeof data!=="string")throw new OfficeKnowledgeError(400,error?.message||"Unable to create knowledge version"); return {version_id:data};
}
export async function publishKnowledge(versionId:string){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_knowledge_publish",{p_actor:current.identity.userId,p_version:versionId});
 if(error||data!==true)throw new OfficeKnowledgeError(400,error?.message||"Unable to publish knowledge version"); return {published:true};
}
