import "server-only";
import {Buffer} from "node:buffer";
import {createHash,randomUUID} from "node:crypto";
import {SecretLockerError,requireOfficeVaultSecretUploader,uploadOfficeVaultSecret}
 from "@/lib/office/vault-secret-server";
import {loadVaultKeyring,openVaultContent,sealVaultContent,type SecretStoredEnvelope}
 from "@/lib/office/vault-secret-crypto";

const BUCKET="office-vault-secrets";
export const SECRET_UPLOAD_PART_SIZE=1_048_576;
const TOTAL_LIMIT=10_485_760;
const allowed:Readonly<Record<string,string>>={
 pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",
 png:"image/png",webp:"image/webp",
 docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
type Actor=Awaited<ReturnType<typeof requireOfficeVaultSecretUploader>>;
type Ingress={
 id:string;owner_user_id:string;document_id:string;version_id:string;
 title:string;classification:string;filename:string;declared_mime:string;
 total_bytes:number;sha256:string;part_size:number;part_count:number;
 expires_at:string;state:string;updated_at:string;
};
type Part={
 session_id:string;part_index:number;part_id:string;byte_size:number;sha256:string;
 sealed_path:string;key_id:string;wrapped_key:string;wrap_nonce:string;wrap_tag:string;
 content_nonce:string;content_tag:string;state:string;created_at:string;
};
const validUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const digest=(data:Uint8Array)=>createHash("sha256").update(data).digest("hex");
const isSha=(value:string)=>/^[a-f0-9]{64}$/.test(value);
function cleanFilename(raw:string){
 const name=raw.replace(/[\/\\\x00-\x1f\x7f]/g,"_").trim().slice(0,180);
 if(!name||name==="."||name==="..")throw new SecretLockerError(400,"A safe filename is required");
 return name;
}
async function session(current:Actor,id:string):Promise<Ingress>{
 if(!validUuid(id))throw new SecretLockerError(404,"Upload session unavailable");
 const result=await current.admin.from("office_vault_secret_ingress_sessions")
  .select("id,owner_user_id,document_id,version_id,title,classification,filename,declared_mime,total_bytes,sha256,part_size,part_count,expires_at,state,updated_at")
  .eq("id",id).eq("owner_user_id",current.identity.userId).maybeSingle();
 if(result.error)throw new SecretLockerError(503,"Staging authority is unavailable");
 if(!result.data)throw new SecretLockerError(404,"Upload session unavailable");
 if(result.data.state!=="DONE"&&Date.parse(result.data.expires_at)<=Date.now())
  throw new SecretLockerError(410,"Encrypted upload session expired");
 return result.data as Ingress;
}
async function parts(current:Actor,id:string):Promise<Part[]>{
 const result=await current.admin.from("office_vault_secret_ingress_parts")
  .select("session_id,part_index,part_id,byte_size,sha256,sealed_path,key_id,wrapped_key,wrap_nonce,wrap_tag,content_nonce,content_tag,state,created_at")
  .eq("session_id",id).order("part_index",{ascending:true}).limit(11);
 if(result.error)throw new SecretLockerError(503,"Encrypted part metadata unavailable");
 return (result.data??[]) as Part[];
}
async function purge(current:Actor,id:string){
 const existing=await parts(current,id);
 if(!existing.length)return true;
 const paths=existing.map(p=>p.sealed_path);
 const removed=await current.admin.storage.from(BUCKET).remove(paths);
 if(removed.error)return false;
 const deleted=await current.admin.from("office_vault_secret_ingress_parts")
  .delete().eq("session_id",id);
 return !deleted.error;
}
async function finished(current:Actor,info:Ingress){
 const result=await current.admin.from("office_vault_secret_versions")
  .select("document_id,id,scan_state").eq("id",info.version_id).maybeSingle();
 if(result.error)throw new SecretLockerError(503,"Registered evidence status unavailable");
 if(!result.data||result.data.document_id!==info.document_id)
  throw new SecretLockerError(409,"Encrypted document registration is not yet verified");
 return {document_id:info.document_id,version_id:info.version_id,
  status:result.data.scan_state==="CLEAN"?"CLEAN":
   result.data.scan_state==="BLOCKED"?"BLOCKED":"QUARANTINED"};
}
export async function startOfficeVaultSecretIngress(input:{
 title:string;classification:string;filename:string;mime:string;
 bytes:number;sha256:string;documentId?:string;
}){
 const current=await requireOfficeVaultSecretUploader();
 const name=cleanFilename(input.filename);
 const ext=name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]??"";
 if(!allowed[ext]||(
   input.mime!=="application/octet-stream"&&input.mime!==allowed[ext]))
  throw new SecretLockerError(415,"Document type and declared MIME do not match");
 if(input.bytes<1||input.bytes>TOTAL_LIMIT||!Number.isInteger(input.bytes)||
  !isSha(input.sha256)||input.title.trim().length<3||input.title.trim().length>180||
  !["CONFIDENTIAL","RESTRICTED","BOARD","FINANCE","HR","LEGAL","SECURITY"].includes(input.classification))
  throw new SecretLockerError(400,"Invalid encrypted upload scope");
 if(input.documentId&&!validUuid(input.documentId))
  throw new SecretLockerError(400,"Invalid document version target");
 const quota=await current.admin.from("office_vault_secret_ingress_sessions")
  .select("id",{count:"exact",head:true}).eq("owner_user_id",current.identity.userId)
  .eq("state","OPEN").gt("expires_at",new Date().toISOString());
 if(quota.error)throw new SecretLockerError(503,"Upload quota authority unavailable");
 if((quota.count??0)>=3)throw new SecretLockerError(429,"Three active encrypted uploads is the maximum");
 const id=randomUUID();
 const expected=Math.ceil(input.bytes/SECRET_UPLOAD_PART_SIZE);
 const expires=new Date(Date.now()+60*60*1000).toISOString();
 const documentId=input.documentId||randomUUID(),versionId=randomUUID();
 const created=await current.admin.from("office_vault_secret_ingress_sessions").insert({
  id,owner_user_id:current.identity.userId,document_id:documentId,
  version_id:versionId,title:input.title.trim(),classification:input.classification,
  filename:name,declared_mime:allowed[ext],total_bytes:input.bytes,sha256:input.sha256,
  part_size:SECRET_UPLOAD_PART_SIZE,part_count:expected,expires_at:expires,
 }).select("id").single();
 if(created.error||!created.data)throw new SecretLockerError(503,"Private upload session not recorded");
 return {session_id:id,chunk_size:SECRET_UPLOAD_PART_SIZE,total_chunks:expected,expires_at:expires};
}
export async function getOfficeVaultSecretIngress(id:string){
 const current=await requireOfficeVaultSecretUploader();
 const record=await session(current,id);
 const entries=record.state==="DONE"?[]:await parts(current,id);
 return {session_id:record.id,state:record.state,expires_at:record.expires_at,
  total_chunks:record.part_count,
  received:entries.filter(e=>e.state==="READY").map(e=>e.part_index)};
}
export async function uploadOfficeVaultSecretPart(id:string,index:number,data:Buffer){
 try{
  const current=await requireOfficeVaultSecretUploader();
  const record=await session(current,id);
  if(record.state!=="OPEN")throw new SecretLockerError(409,"Upload session is no longer accepting parts");
  if(!Number.isInteger(index)||index<0||index>=record.part_count)
   throw new SecretLockerError(400,"Invalid encrypted upload part");
  const required=Math.min(SECRET_UPLOAD_PART_SIZE,record.total_bytes-index*SECRET_UPLOAD_PART_SIZE);
  if(data.length!==required)throw new SecretLockerError(400,"Incorrect encrypted upload part length");
  const proof=digest(data);
  const original=await current.admin.from("office_vault_secret_ingress_parts")
   .select("part_id,sha256,state,byte_size").eq("session_id",record.id)
   .eq("part_index",index).maybeSingle();
  if(original.error)throw new SecretLockerError(503,"Part authority unavailable");
  if(original.data){
    if(original.data.sha256===proof&&original.data.state==="READY"&&
      original.data.byte_size===required)
      return {part_index:index,state:"READY" as const,idempotent:true};
    throw new SecretLockerError(409,"Encrypted part already claimed; retry or abort the session");
  }
  const partId=randomUUID();
  const envelope=sealVaultContent(data,id,partId,loadVaultKeyring());
  const path="ingress/"+id+"/"+index+".sealed";
  const inserted=await current.admin.from("office_vault_secret_ingress_parts").insert({
   session_id:id,part_index:index,part_id:partId,byte_size:required,
   sha256:proof,sealed_path:path,key_id:envelope.keyId,wrapped_key:envelope.wrappedKey,
   wrap_nonce:envelope.wrapNonce,wrap_tag:envelope.wrapTag,
   content_nonce:envelope.contentNonce,content_tag:envelope.contentTag,
   state:"PENDING",
  });
  if(inserted.error)throw new SecretLockerError(409,"Part already claimed");
  const object=await current.admin.storage.from(BUCKET).upload(path,envelope.ciphertext,{
   contentType:"application/octet-stream",cacheControl:"0",upsert:false,
  });
  if(object.error){
    await current.admin.from("office_vault_secret_ingress_parts")
      .delete().eq("session_id",id).eq("part_index",index).eq("part_id",partId)
      .eq("state","PENDING");
    throw new SecretLockerError(503,"Private encrypted part storage unavailable");
  }
  const ready=await current.admin.from("office_vault_secret_ingress_parts")
   .update({state:"READY",updated_at:new Date().toISOString()})
   .eq("session_id",id).eq("part_index",index).eq("part_id",partId)
   .eq("state","PENDING").select("part_index").maybeSingle();
  if(ready.error||!ready.data)
   throw new SecretLockerError(409,"Encrypted part not durably verified; abort and retry");
  return {part_index:index,state:"READY" as const,idempotent:false};
 }finally{
  // The ingress path never passes raw client evidence to persistent storage.
  data.fill(0);
 }
}
export async function completeOfficeVaultSecretIngress(id:string){
 const current=await requireOfficeVaultSecretUploader();
 const record=await session(current,id);
 if(record.state==="DONE")return {...await finished(current,record),cleanup_pending:!(await purge(current,id))};
 const threshold=new Date(Date.now()-120000).toISOString();
 let claimed=await current.admin.from("office_vault_secret_ingress_sessions")
   .update({state:"FINALIZING",updated_at:new Date().toISOString()})
   .eq("id",id).eq("owner_user_id",current.identity.userId).eq("state","OPEN")
   .gt("expires_at",new Date().toISOString()).select("id").maybeSingle();
 if(claimed.error)throw new SecretLockerError(503,"Upload claim authority unavailable");
 if(!claimed.data&&record.state==="FINALIZING"){
  claimed=await current.admin.from("office_vault_secret_ingress_sessions")
    .update({state:"FINALIZING",updated_at:new Date().toISOString()})
    .eq("id",id).eq("owner_user_id",current.identity.userId).eq("state","FINALIZING")
    .lt("updated_at",threshold).select("id").maybeSingle();
 }
 if(claimed.error||!claimed.data)throw new SecretLockerError(409,"Upload finalization is already claimed or expired");
 let success=false;
 const assembled=Buffer.alloc(record.total_bytes);
 try{
  const prior=await current.admin.from("office_vault_secret_versions")
   .select("id").eq("id",record.version_id).maybeSingle();
  if(prior.error)throw new SecretLockerError(503,"Upload idempotency authority unavailable");
  let result:{document_id:string;version_id:string;status:string};
  if(prior.data){
   result=await finished(current,record);
  }else{
   const entries=await parts(current,id);
   if(entries.length!==record.part_count||entries.some((p,i)=>p.part_index!==i||p.state!=="READY")||
     entries.reduce((total,p)=>total+p.byte_size,0)!==record.total_bytes)
     throw new SecretLockerError(409,"Encrypted upload is incomplete");
   let offset=0;
   const keyring=loadVaultKeyring();
   for(const part of entries){
    const fetched=await current.admin.storage.from(BUCKET).download(part.sealed_path);
    if(fetched.error||!fetched.data)
     throw new SecretLockerError(503,"Encrypted upload part unavailable");
    const ciphertext=Buffer.from(await fetched.data.arrayBuffer());
    let plain:Buffer|undefined;
    try{
     const envelope:SecretStoredEnvelope={
      key_id:part.key_id,wrapped_key:part.wrapped_key,wrap_nonce:part.wrap_nonce,
      wrap_tag:part.wrap_tag,content_nonce:part.content_nonce,content_tag:part.content_tag,
      sha256:part.sha256,byte_size:part.byte_size,
     };
     plain=openVaultContent(ciphertext,record.id,part.part_id,envelope,keyring);
     plain.copy(assembled,offset);
     offset+=plain.length;
    }finally{
     plain?.fill(0);ciphertext.fill(0);
    }
   }
   if(offset!==record.total_bytes||digest(assembled)!==record.sha256)
    throw new SecretLockerError(422,"Encrypted upload failed end-to-end integrity verification");
   // File is a short-lived in-memory adapter: the existing sealed-file
   // service still rechecks permissions, MIME/magic bytes, encryption,
   // scanning, version immutability and independent review.
   const file=new File([Uint8Array.from(assembled)],record.filename,{
    type:record.declared_mime,
   });
   result=await uploadOfficeVaultSecret({
    file,title:record.title,classification:record.classification,
    documentId:record.document_id,versionId:record.version_id,
   });
  }
  const done=await current.admin.from("office_vault_secret_ingress_sessions")
   .update({state:"DONE",updated_at:new Date().toISOString()})
   .eq("id",id).eq("owner_user_id",current.identity.userId)
   .eq("state","FINALIZING").select("id").maybeSingle();
  if(done.error||!done.data)throw new SecretLockerError(503,"Upload finalization status not confirmed");
  success=true;
  const cleanupPending=!(await purge(current,id));
  return {...result,cleanup_pending:cleanupPending};
 }finally{
  assembled.fill(0);
  if(!success){
   // A failed request can be retried; if the document already registered,
   // the next attempt returns its exact source status rather than duplicating.
   await current.admin.from("office_vault_secret_ingress_sessions")
    .update({state:"OPEN",updated_at:new Date().toISOString()})
    .eq("id",id).eq("owner_user_id",current.identity.userId).eq("state","FINALIZING");
  }
 }
}
export async function abortOfficeVaultSecretIngress(id:string){
 const current=await requireOfficeVaultSecretUploader();
 const record=await session(current,id);
 if(record.state!=="OPEN")throw new SecretLockerError(409,"Only open sessions may be cancelled");
 const result=await current.admin.from("office_vault_secret_ingress_sessions")
  .update({state:"ABORTED",updated_at:new Date().toISOString()})
  .eq("id",id).eq("owner_user_id",current.identity.userId)
  .eq("state","OPEN").select("id").maybeSingle();
 if(result.error||!result.data)throw new SecretLockerError(409,"Encrypted upload cancellation not confirmed");
 return {aborted:true,cleanup_pending:!(await purge(current,id))};
}
