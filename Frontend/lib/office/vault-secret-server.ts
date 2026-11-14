import "server-only";
import {randomUUID,createHash} from "node:crypto";
import {Buffer} from "node:buffer";
import {getOfficeRuntimeOrigin} from "@/lib/env/office";
import {getOfficeSessionContext} from "@/lib/office/auth-server";
import {requireOfficeActor,resolveOfficePermission,OfficePermissionError} from "@/lib/office/permission-engine";
import {currentOfficeTrustedDeviceId} from "@/lib/office/device-binding-server";
import {requireOfficeVaultRecord} from "@/lib/office/vault-access-server";
import {loadVaultKeyring,openVaultContent,sealVaultContent,type SecretStoredEnvelope} from "@/lib/office/vault-secret-crypto";
import {secretGrantRights,secretDocumentVisible,secretVersionVisible} from "@/lib/office/vault-secret-visibility";

const BUCKET="office-vault-secrets";
const MAX_BYTES=10_485_760;
const mimeByExt:Readonly<Record<string,string>>={
 pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",
 png:"image/png",webp:"image/webp",
 docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const classifications=["CONFIDENTIAL","RESTRICTED","BOARD","FINANCE","HR","LEGAL","SECURITY"] as const;
export type SecretClassification=typeof classifications[number];
export class SecretLockerError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name="SecretLockerError";}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;
type SecretDocument={id:string;owner_user_id:string;title:string;classification:string;state:string;created_at:string;updated_at:string};
type SecretVersion={
 id:string;document_id:string;version_number:number;uploaded_by:string;
 filename:string;mime_type:string;byte_size:number;sha256:string;
 sealed_path:string;key_id:string;wrapped_key:string;wrap_nonce:string;wrap_tag:string;
 content_nonce:string;content_tag:string;scan_state:string;review_state:string;
 reviewed_by:string|null;reviewed_at:string|null;scanner_at:string|null;created_at:string;
};
const permittedClass=(value:string):value is SecretClassification=>
 classifications.some(c=>c===value);
function sha(value:Buffer){return createHash("sha256").update(value).digest("hex");}
function sanitizedFilename(name:string){
 const value=name.replace(/[\/\\\x00-\x1f\x7f]/g,"_").trim().slice(0,180);
 if(!value||value==="."||value==="..")throw new SecretLockerError(400,"A safe document filename is required");
 return value;
}
function detectMime(data:Buffer,filename:string,declared:string){
 const ext=filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]??"";
 const expected=mimeByExt[ext];
 if(!expected)throw new SecretLockerError(415,"Only PDF, JPEG, PNG, WebP, DOCX and XLSX documents may be sealed");
 let detected="";
 if(data.subarray(0,5).toString("ascii")==="%PDF-")detected="application/pdf";
 else if(data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff)detected="image/jpeg";
 else if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))detected="image/png";
 else if(data.subarray(0,4).toString("ascii")==="RIFF"&&data.subarray(8,12).toString("ascii")==="WEBP")detected="image/webp";
 else if(data.subarray(0,4).toString("ascii")==="PK\x03\x04"){
  // ZIP entry filenames are stored uncompressed. This is only a type guard:
  // the independent ClamAV scanner remains the authority for safe release.
  const content=data.toString("latin1");
  if(content.includes("vbaProject.bin")||content.includes("../"))
    throw new SecretLockerError(415,"Macro-enabled or path-traversing Office archives are blocked");
  if(content.includes("[Content_Types].xml")){
   if(content.includes("word/document.xml"))detected=mimeByExt.docx;
   else if(content.includes("xl/workbook.xml"))detected=mimeByExt.xlsx;
  }
 }
 if(detected!==expected||(declared&&declared!=="application/octet-stream"&&declared!==detected))
  throw new SecretLockerError(415,"The document extension, MIME type and bytes do not agree");
 return detected;
}
async function actor():Promise<Actor>{
 try{
  const current=await requireOfficeActor();
  if(current.identity.workspaceStatus!=="ACTIVE")throw new SecretLockerError(403,"An active Office identity is required");
  return current;
 }catch(error){
  if(error instanceof OfficePermissionError)throw new SecretLockerError(error.status,error.message);
  throw error;
 }
}
async function permission(current:Actor,code:string){
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 if(!device)throw new SecretLockerError(403,"A bound trusted company device is required for secret documents");
 const {data,error}=await current.admin.from("office_device_registry")
  .select("trust_state,company_managed,revoked_at").eq("id",device)
  .eq("user_id",current.identity.userId).maybeSingle();
 if(error||!data||data.trust_state!=="TRUSTED"||
    data.company_managed!==true||data.revoked_at)
  throw new SecretLockerError(403,"A trusted managed device is required for secret documents");
 const decision=await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},device);
 if(!decision.allowed)throw new SecretLockerError(403,"Secret document authority is not assigned");
}
async function hasPermission(current:Actor,code:string){
 try{await permission(current,code);return true;}
 catch(error){if(error instanceof SecretLockerError&&error.status===403)return false;throw error;}
}
async function record(current:Actor,version:SecretVersion,kind:
 "SEALED"|"SCAN_CLEAN"|"SCAN_BLOCKED"|"SCAN_UNKNOWN"|"APPROVED"|"REJECTED"|"PREVIEWED"|"DOWNLOADED"){
 const {error}=await current.admin.from("office_vault_secret_events").insert({
  document_id:version.document_id,version_id:version.id,
  actor_user_id:current.identity.userId,event_type:kind,
 });
 if(error)throw new SecretLockerError(503,"Secret evidence action cannot proceed without an audit record");
}
async function scan(data:Buffer,mime:string){
 const origin=getOfficeRuntimeOrigin(),session=await getOfficeSessionContext();
 if(!origin||!session||session.identity.aal!=="aal2")return "UNKNOWN" as const;
 try{
  const response=await fetch(new URL("/api/v1/security/file-scan",origin),{
   method:"POST",headers:{"Content-Type":mime,
    Authorization:"Bearer "+session.session.access_token},
   body:new Uint8Array(data),cache:"no-store",redirect:"manual",
   signal:AbortSignal.timeout(50000),
  });
  if(response.status===422||response.status===415)return "BLOCKED" as const;
  if(!response.ok)return "UNKNOWN" as const;
  const verdict=await response.json().catch(()=>null) as {clean?:boolean;sha256?:string;byte_size?:number}|null;
  if(verdict?.clean!==true||verdict.sha256!==sha(data)||verdict.byte_size!==data.length)
   return "UNKNOWN" as const;
  return "CLEAN" as const;
 }catch{return "UNKNOWN" as const;}
}
async function storedVersion(current:Actor,versionId:string){
 const {data,error}=await current.admin.from("office_vault_secret_versions")
 .select("id,document_id,version_number,uploaded_by,filename,mime_type,byte_size,sha256,sealed_path,key_id,wrapped_key,wrap_nonce,wrap_tag,content_nonce,content_tag,scan_state,review_state,reviewed_by,reviewed_at,scanner_at,created_at")
 .eq("id",versionId).maybeSingle();
 if(error)throw new SecretLockerError(503,"Secret version authority unavailable");
 if(!data)throw new SecretLockerError(404,"Document unavailable");
 return data as SecretVersion;
}
async function decryptStored(current:Actor,version:SecretVersion){
 const stored=await current.admin.storage.from(BUCKET).download(version.sealed_path);
 if(stored.error||!stored.data)throw new SecretLockerError(503,"Private encrypted object unavailable");
 const ciphertext=Buffer.from(await stored.data.arrayBuffer());
 if(ciphertext.length!==version.byte_size||ciphertext.length>MAX_BYTES)
  throw new SecretLockerError(503,"Sealed file length mismatch");
 const evidence:SecretStoredEnvelope={
  key_id:version.key_id,wrapped_key:version.wrapped_key,
  wrap_nonce:version.wrap_nonce,wrap_tag:version.wrap_tag,
  content_nonce:version.content_nonce,content_tag:version.content_tag,
  sha256:version.sha256,byte_size:version.byte_size,
 };
 try{return openVaultContent(ciphertext,version.document_id,version.id,evidence,loadVaultKeyring());}
 catch{throw new SecretLockerError(503,"Document integrity verification failed");}
}
export async function uploadOfficeVaultSecret(input:{
 file:File;title:string;classification:string;documentId?:string;
}){
 const current=await actor();
 await permission(current,"vault.secret.upload");
 if(!permittedClass(input.classification)||input.title.trim().length<3||input.title.trim().length>180)
  throw new SecretLockerError(400,"Valid title and secret classification are required");
 if(input.file.size<1||input.file.size>MAX_BYTES)
  throw new SecretLockerError(413,"Secret documents must be between 1 byte and 10 MiB");
 const filename=sanitizedFilename(input.file.name);
 const data=Buffer.from(await input.file.arrayBuffer());
 // Do not retain plaintext beyond the encryption and scanner boundary, even
 // when validation, private storage, registration, or scanning fails.
 try{
 const mime=detectMime(data,filename,input.file.type||"");
 const documentId=input.documentId||randomUUID(),versionId=randomUUID();
 const sealed=sealVaultContent(data,documentId,versionId,loadVaultKeyring());
 const path=documentId+"/"+versionId+".sealed";
 const object=await current.admin.storage.from(BUCKET).upload(path,sealed.ciphertext,{
  contentType:"application/octet-stream",cacheControl:"0",upsert:false,
 });
 if(object.error)throw new SecretLockerError(503,"Sealed object storage unavailable");
 const registered=await current.admin.rpc("office_vault_secret_register",{
  p_actor:current.identity.userId,p_document:documentId,p_version:versionId,
  p_title:input.title.trim(),p_classification:input.classification,p_filename:filename,
  p_mime:mime,p_size:data.length,p_sha:sealed.sha256,p_path:path,
  p_key_id:sealed.keyId,p_wrapped_key:sealed.wrappedKey,p_wrap_nonce:sealed.wrapNonce,
  p_wrap_tag:sealed.wrapTag,p_content_nonce:sealed.contentNonce,p_content_tag:sealed.contentTag,
 });
 if(registered.error||registered.data!==documentId){
  await current.admin.storage.from(BUCKET).remove([path]);
  throw new SecretLockerError(409,"Secret record was not durably registered");
 }
 // A failed scanner never converts an upload into an approved or readable file.
 const verdict=await scan(data,mime);
 if(verdict==="UNKNOWN"){
  const version=await storedVersion(current,versionId);
  await record(current,version,"SCAN_UNKNOWN");
  return {document_id:documentId,version_id:versionId,status:"QUARANTINED" as const};
 }
 const result=await current.admin.rpc("office_vault_secret_scan_result",{
  p_actor:current.identity.userId,p_version:versionId,p_sha:sealed.sha256,
  p_clean:verdict==="CLEAN",
 });
 if(result.error||result.data!==verdict)
  throw new SecretLockerError(503,"Secret scanner outcome could not be recorded");
 return {document_id:documentId,version_id:versionId,status:verdict};
 }finally{data.fill(0);}
}
export async function retryOfficeVaultSecretScan(versionId:string){
 const current=await actor();await permission(current,"vault.secret.upload");
 const version=await storedVersion(current,versionId);
 if(version.uploaded_by!==current.identity.userId||version.scan_state!=="QUARANTINED")
  throw new SecretLockerError(404,"Quarantined upload unavailable");
 const data=await decryptStored(current,version);
 try{
 const verdict=await scan(data,version.mime_type);
 if(verdict==="UNKNOWN"){
  await record(current,version,"SCAN_UNKNOWN");
  return {status:"QUARANTINED" as const};
 }
 const result=await current.admin.rpc("office_vault_secret_scan_result",{
  p_actor:current.identity.userId,p_version:version.id,p_sha:version.sha256,
  p_clean:verdict==="CLEAN",
 });
 if(result.error||result.data!==verdict)
  throw new SecretLockerError(503,"Scanner outcome could not be committed");
 return {status:verdict};
 }finally{data.fill(0);}
}
export async function reviewOfficeVaultSecret(input:{versionId:string;approve:boolean;note:string}){
 const current=await actor();await permission(current,"vault.secret.review");
 if(input.note.trim().length<12)throw new SecretLockerError(400,"Independent review requires a rationale");
 const version=await storedVersion(current,input.versionId);
 if(version.uploaded_by===current.identity.userId||version.review_state!=="PENDING")
  throw new SecretLockerError(404,"Independent review item unavailable");
 const {data,error}=await current.admin.rpc("office_vault_secret_review",{
  p_actor:current.identity.userId,p_version:version.id,
  p_approve:input.approve,p_note:input.note.trim(),
 });
 if(error||data!==(input.approve?"APPROVED":"REJECTED"))
  throw new SecretLockerError(409,"Independent secret review was not recorded");
 return {status:data};
}
export async function getOfficeVaultSecretLocker(){
 const current=await actor();
 const [mayUpload,mayReview,mayRead,mayDownload]=await Promise.all([
  hasPermission(current,"vault.secret.upload"),
  hasPermission(current,"vault.secret.review"),
  hasPermission(current,"vault.secret.read"),
  hasPermission(current,"vault.secret.download"),
 ]);
 if(!mayUpload&&!mayReview&&!mayRead)throw new SecretLockerError(403,"Secret locker authority is not assigned");
 const grants=mayRead?await current.admin.from("office_vault_access_grants")
  .select("resource_id,action").eq("grantee_user_id",current.identity.userId)
  .eq("category_slug","secrets").is("revoked_at",null)
  .gt("expires_at",new Date().toISOString())
  .in("action",["READ","PREVIEW","DOWNLOAD"]).limit(500):
  {data:[],error:null};
 if(grants.error)throw new SecretLockerError(503,"Secret grant authority unavailable");
 // A reviewer is authorized to see pending-review records only. A global
 // review capability is not a blanket corporate-document browse grant.
 const pending=mayReview?await current.admin.from("office_vault_secret_versions")
  .select("document_id").eq("review_state","PENDING").limit(1000):
  {data:[],error:null};
 if(pending.error)throw new SecretLockerError(503,"Independent review queue unavailable");
 const pendingDocumentIds=new Set((pending.data??[]).map(row=>String(row.document_id)));
 const currentGrants=grants.data??[];
 // Query only the authorized source scopes. A global service-role scan of
 // the latest 500 records hides older owned documents and touches unrelated
 // corporate evidence before the application-level visibility filter.
 const categoryWide=mayRead&&currentGrants.some(grant=>grant.resource_id===null);
 const scopedIds=[...new Set([
  ...currentGrants.filter(grant=>mayRead&&grant.resource_id!==null)
   .map(grant=>String(grant.resource_id)),
  ...(mayReview?[...pendingDocumentIds]:[]),
 ])].filter(id=>/^[0-9a-f-]{36}$/i.test(id));
 if(scopedIds.length>1500)
  throw new SecretLockerError(503,"Secret listing exceeds the safe authorization window");
 const select="id,owner_user_id,title,classification,state,created_at,updated_at";
 const queries=[];
 if(mayUpload)queries.push(current.admin.from("office_vault_secret_documents")
  .select(select).eq("state","ACTIVE").eq("owner_user_id",current.identity.userId)
  .order("updated_at",{ascending:false}).limit(500));
 if(categoryWide)queries.push(current.admin.from("office_vault_secret_documents")
  .select(select).eq("state","ACTIVE").order("updated_at",{ascending:false}).limit(500));
 else for(let offset=0;offset<scopedIds.length;offset+=100){
  queries.push(current.admin.from("office_vault_secret_documents")
   .select(select).eq("state","ACTIVE").in("id",scopedIds.slice(offset,offset+100))
   .order("updated_at",{ascending:false}).limit(100));
 }
 const sources=await Promise.all(queries);
 if(sources.some(result=>result.error))
  throw new SecretLockerError(503,"Scoped secret-document directory unavailable");
 const unique=new Map<string,SecretDocument>();
 for(const result of sources)for(const row of result.data??[])
  unique.set(String(row.id),row as SecretDocument);
 const documents=[...unique.values()].sort((a,b)=>
  Date.parse(b.updated_at)-Date.parse(a.updated_at));
 const visible=documents.filter(row=>{
  const rights=secretGrantRights(currentGrants,row.id);
  return secretDocumentVisible({
   isOwner:row.owner_user_id===current.identity.userId,canUpload:mayUpload,
   canRead:mayRead,readGrant:rights.read,canReview:mayReview,
   hasPendingReview:pendingDocumentIds.has(row.id),
  });
 });
 const versions=visible.length?await current.admin.from("office_vault_secret_versions")
  .select("id,document_id,version_number,uploaded_by,filename,mime_type,byte_size,scan_state,review_state,created_at,reviewed_at")
  .in("document_id",visible.map(row=>row.id)).order("created_at",{ascending:false}).limit(900):
  {data:[],error:null};
 if(versions.error)throw new SecretLockerError(503,"Secret document version inventory unavailable");
 const listings=(versions.data??[]).filter(v=>visible.some(d=>d.id===v.document_id));
 return {as_of:new Date().toISOString(),
  actor_user_id:current.identity.userId,
  capabilities:{upload:mayUpload,review:mayReview,read:mayRead},
  documents:visible.map(d=>{
   const rights=secretGrantRights(currentGrants,d.id);
   const isOwner=d.owner_user_id===current.identity.userId;
   const granted=mayRead&&rights.read;
   return {
    id:d.id,title:d.title,classification:d.classification,state:d.state,
    created_at:d.created_at,updated_at:d.updated_at,
    is_owner:isOwner,grant_active:granted,
    preview_allowed:granted&&rights.preview,
    download_allowed:granted&&mayDownload&&rights.download,
    versions:listings.filter(v=>v.document_id===d.id)
      .filter(v=>secretVersionVisible({
       ownerUpload:isOwner&&mayUpload,
       independentReview:mayReview&&pendingDocumentIds.has(d.id),
       grantedRead:granted,
       reviewState:String(v.review_state),scanState:String(v.scan_state),
      }))
      .map(v=>({
       id:v.id,version_number:v.version_number,filename:v.filename,
       mime_type:v.mime_type,byte_size:v.byte_size,
       scan_state:v.scan_state,review_state:v.review_state,
       created_at:v.created_at,reviewed_at:v.reviewed_at,
      })),
   };
  }).filter(d=>d.versions.length>0),
 };
}
export async function downloadOfficeVaultSecret(versionId:string,action:"PREVIEW"|"DOWNLOAD"){
 const current=await actor();
 await permission(current,action==="DOWNLOAD"?"vault.secret.download":"vault.secret.read");
 const version=await storedVersion(current,versionId);
 if(version.scan_state!=="CLEAN"||version.review_state!=="APPROVED")
  throw new SecretLockerError(404,"Secret document unavailable");
 if(action==="PREVIEW"&&version.mime_type!=="application/pdf"&&
    !["image/jpeg","image/png","image/webp"].includes(version.mime_type))
  throw new SecretLockerError(415,"This document format cannot be previewed safely");
 await requireOfficeVaultRecord({category:"secrets",recordId:version.document_id,action});
 const bytes=await decryptStored(current,version);
 let transferred=false;
 try{
  await record(current,version,action==="DOWNLOAD"?"DOWNLOADED":"PREVIEWED");
  // The response's cancel/end handler now owns this buffer and clears it.
  transferred=true;
  return {bytes,mime:version.mime_type,filename:version.filename,sha256:version.sha256};
 }finally{
  // Audit failure must not strand decrypted evidence in the server heap.
  if(!transferred)bytes.fill(0);
 }
}
