import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {getOfficeRuntimeOrigin} from "@/lib/env/office";
import {getOfficeSessionContext} from "@/lib/office/auth-server";
import {requireOfficeChatConversation,listOfficeChatConversations} from "@/lib/office/chat-server";

const quarantine="office-quarantine";
const released="office-chat-attachments";
const MAX_BYTES=4_194_304;

export class OfficeChatAttachmentError extends Error {
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeChatAttachmentError";}
}

function detect(bytes:Buffer,filename:string):{mime:string;extension:string}{
 const ext=filename.toLowerCase().split(".").at(-1)??"";
 const typeMap:Record<string,{mime:string;extension:string}>={
  pdf:{mime:"application/pdf",extension:"pdf"},
  jpg:{mime:"image/jpeg",extension:"jpg"},jpeg:{mime:"image/jpeg",extension:"jpg"},
  png:{mime:"image/png",extension:"png"},webp:{mime:"image/webp",extension:"webp"},
  gif:{mime:"image/gif",extension:"gif"},
  mp4:{mime:"video/mp4",extension:"mp4"},webm:{mime:"video/webm",extension:"webm"},
  txt:{mime:"text/plain",extension:"txt"},
  docx:{mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",extension:"docx"},
  xlsx:{mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",extension:"xlsx"},
 };
 const expected=typeMap[ext];
 if(!expected)throw new OfficeChatAttachmentError(415,"Unsupported chat attachment extension");
 let detected="";
 if(bytes.length>=5&&bytes.toString("ascii",0,5)==="%PDF-")detected="application/pdf";
 else if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  detected="image/png";
 else if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)
  detected="image/jpeg";
 else if(bytes.length>=12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")
  detected="image/webp";
 else if(["GIF87a","GIF89a"].includes(bytes.toString("ascii",0,6)))detected="image/gif";
 else if(bytes.length>=12&&bytes.toString("ascii",4,8)==="ftyp"&&
  ["isom","iso2","mp41","mp42","avc1","M4V ","MSNV"].includes(bytes.toString("ascii",8,12)))
  detected="video/mp4";
 else if(bytes.length>=8&&bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&
   bytes.subarray(0,128).toString("latin1").toLowerCase().includes("webm"))
  detected="video/webm";
 else if(bytes.length>=4&&bytes.toString("latin1",0,4)==="PK\x03\x04"){
  // OOXML is never rendered in the browser; ClamAV must also confirm clean.
  const listing=bytes.toString("latin1");
  if(listing.includes("../")||listing.includes("..\\")||listing.includes("vbaProject.bin")||
    listing.includes("activeX/"))throw new OfficeChatAttachmentError(415,"Unsafe Office archive blocked");
  if(listing.includes("[Content_Types].xml")&&listing.includes("word/document.xml"))
   detected=typeMap.docx.mime;
  if(listing.includes("[Content_Types].xml")&&listing.includes("xl/workbook.xml"))
   detected=typeMap.xlsx.mime;
 }else if(ext==="txt"&&bytes.length<=MAX_BYTES&&!bytes.includes(0)){
  try{
   const data=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   if(data&&!/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(data))detected="text/plain";
  }catch{detected="";}
 }
 if(detected!==expected.mime)throw new OfficeChatAttachmentError(415,
  "File extension, signature and declared media type must match");
 return expected;
}
function safeFilename(name:string){
 const value=name.replace(/[\u0000-\u001f\u007f\\/]/g,"_").trim().slice(0,180);
 if(!value)throw new OfficeChatAttachmentError(400,"A filename is required");
 return value;
}
async function scanner(bytes:Buffer,mime:string){
 const origin=getOfficeRuntimeOrigin();
 const context=await getOfficeSessionContext();
 if(!origin||!context||context.identity.aal!=="aal2")
  throw new OfficeChatAttachmentError(503,"Verified Office scanner is unavailable");
 let response:Response;
 try{
  response=await fetch(new URL("/api/v1/security/file-scan",origin),{
   method:"POST",
   headers:{Authorization:"Bearer "+context.session.access_token,"Content-Type":mime,
    "Content-Length":String(bytes.length)},
   body:new Uint8Array(bytes),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(35_000),
  });
 }catch{throw new OfficeChatAttachmentError(503,"File scanner unavailable; upload remains quarantined");}
 if(response.status===422)throw new OfficeChatAttachmentError(422,"File rejected by the corporate security scanner");
 if(!response.ok)throw new OfficeChatAttachmentError(503,"Security scan outcome unavailable");
 const verdict=await response.json().catch(()=>null) as {clean?:boolean;sha256?:string;byte_size?:number}|null;
 const digest=createHash("sha256").update(bytes).digest("hex");
 if(verdict?.clean!==true||verdict.sha256!==digest||verdict.byte_size!==bytes.length)
  throw new OfficeChatAttachmentError(422,"The corporate scanner did not confirm a clean matching file");
 return digest;
}
type AttachmentRow={
 id:string;conversation_id:string;message_id:string|null;uploader_user_id:string;
 original_filename:string;detected_mime_type:string;byte_size:number;sha256:string;
 quarantine_path:string;released_path:string|null;status:string;
};
async function recordEvent(admin:Awaited<ReturnType<typeof requireOfficeChatConversation>>["admin"],input:{
 id:string;actor:string;kind:"QUARANTINED"|"SCAN_CLEAN"|"SCAN_BLOCKED"|"SCAN_UNKNOWN"|"LINKED"|"DOWNLOADED"
}){
 const {error}=await admin.from("office_chat_attachment_events").insert({
  attachment_id:input.id,actor_user_id:input.actor,event_type:input.kind
 });
 if(error)throw new OfficeChatAttachmentError(503,"File state could not be durably audited");
}
async function fetchOwn(id:string){
 const current=await requireOfficeChatConversationForAttachment(id);
 return current;
}
async function requireOfficeChatConversationForAttachment(id:string){
 const {requireOfficeActor}=await import("@/lib/office/permission-engine");
 const actor=await requireOfficeActor();
 const {data,error}=await actor.admin.from("office_chat_attachment_objects").select(
  "id,conversation_id,message_id,uploader_user_id,original_filename,detected_mime_type,byte_size,sha256,quarantine_path,released_path,status"
 ).eq("id",id).maybeSingle();
 if(error)throw new OfficeChatAttachmentError(503,"Attachment authority temporarily unavailable");
 if(!data)throw new OfficeChatAttachmentError(404,"Attachment unavailable");
 const current=await requireOfficeChatConversation(String(data.conversation_id));
 return {current,attachment:data as AttachmentRow};
}
async function advanceScan(id:string){
 const {current,attachment}=await fetchOwn(id);
 if(attachment.uploader_user_id!==current.identity.userId||attachment.message_id)
  throw new OfficeChatAttachmentError(404,"Attachment unavailable");
 if(attachment.status==="CLEAN")return {attachment_id:id,status:"CLEAN"};
 if(attachment.status==="BLOCKED")throw new OfficeChatAttachmentError(422,"File was blocked by security controls");
 if(!["QUARANTINED","FAILED","SCANNING"].includes(attachment.status))
  throw new OfficeChatAttachmentError(409,"File is not awaiting scan review");
 const download=await current.admin.storage.from(quarantine).download(attachment.quarantine_path);
 if(download.error||!download.data)throw new OfficeChatAttachmentError(503,"Quarantined evidence is unavailable");
 const bytes=Buffer.from(await download.data.arrayBuffer());
 if(bytes.length!==Number(attachment.byte_size)||bytes.length>MAX_BYTES)
  throw new OfficeChatAttachmentError(409,"Quarantined file-size integrity check failed");
 const type=detect(bytes,attachment.original_filename);
 if(type.mime!==attachment.detected_mime_type||
   createHash("sha256").update(bytes).digest("hex")!==attachment.sha256)
  throw new OfficeChatAttachmentError(409,"Quarantined content integrity mismatch");
 const changed=await current.admin.from("office_chat_attachment_objects")
  .update({status:"SCANNING"}).eq("id",id).eq("uploader_user_id",current.identity.userId)
  .in("status",["QUARANTINED","FAILED","SCANNING"]).select("id").maybeSingle();
 if(changed.error||!changed.data)throw new OfficeChatAttachmentError(409,"Scan state changed during verification");
 let scanDigest:string;
 try{scanDigest=await scanner(bytes,type.mime);}
 catch(error){
  const blocked=error instanceof OfficeChatAttachmentError&&error.status===422;
  const {error:updateError}=await current.admin.from("office_chat_attachment_objects")
   .update({status:blocked?"BLOCKED":"QUARANTINED",scanned_at:blocked?new Date().toISOString():null})
   .eq("id",id).eq("uploader_user_id",current.identity.userId).eq("status","SCANNING");
  if(updateError)throw new OfficeChatAttachmentError(503,"Unable to record scan outcome; file remains unavailable");
  if(blocked)await current.admin.storage.from(quarantine).remove([attachment.quarantine_path]);
  await recordEvent(current.admin,{id,actor:current.identity.userId,kind:blocked?"SCAN_BLOCKED":"SCAN_UNKNOWN"});
  if(blocked)throw error;
  return {attachment_id:id,status:"QUARANTINED",detail:"Scan not confirmed; the file remains inaccessible until verified"};
 }
 // Verify membership again after a potentially long external scanning request.
 await requireOfficeChatConversation(attachment.conversation_id);
 const path=attachment.conversation_id+"/"+id+"."+type.extension;
 const uploaded=await current.admin.storage.from(released).upload(path,bytes,{
  contentType:type.mime,upsert:false,cacheControl:"0"
 });
 if(uploaded.error)throw new OfficeChatAttachmentError(503,"Secure attachment promotion unavailable; file remains quarantined");
 const updated=await current.admin.from("office_chat_attachment_objects")
  .update({status:"CLEAN",scanned_at:new Date().toISOString(),released_path:path})
  .eq("id",id).eq("status","SCANNING").eq("uploader_user_id",current.identity.userId)
  .select("id").maybeSingle();
 if(updated.error||!updated.data){
  await current.admin.storage.from(released).remove([path]);
  throw new OfficeChatAttachmentError(503,"Attachment state not confirmed; no file was released");
 }
 await recordEvent(current.admin,{id,actor:current.identity.userId,kind:"SCAN_CLEAN"});
 await current.admin.storage.from(quarantine).remove([attachment.quarantine_path]);
 return {attachment_id:id,status:"CLEAN",sha256:scanDigest};
}
export async function uploadOfficeChatAttachment(input:{conversationId:string;file:File}){
 const current=await requireOfficeChatConversation(input.conversationId);
 if(input.file.size<1||input.file.size>MAX_BYTES)
  throw new OfficeChatAttachmentError(413,"Private attachment must be between 1 byte and 4 MiB");
 const bytes=Buffer.from(await input.file.arrayBuffer());
 const type=detect(bytes,input.file.name);
 if(input.file.type&&input.file.type!==type.mime)
  throw new OfficeChatAttachmentError(415,"Declared MIME does not match the file contents");
 const sha=createHash("sha256").update(bytes).digest("hex");
 const id=randomUUID();
 const qpath="chat/"+current.identity.userId+"/"+id+"."+type.extension;
 const upload=await current.admin.storage.from(quarantine).upload(qpath,bytes,{
  contentType:type.mime,upsert:false,cacheControl:"0"
 });
 if(upload.error)throw new OfficeChatAttachmentError(503,"Private quarantine bucket unavailable");
 const inserted=await current.admin.from("office_chat_attachment_objects").insert({
  id,conversation_id:input.conversationId,uploader_user_id:current.identity.userId,
  original_filename:safeFilename(input.file.name),detected_mime_type:type.mime,
  byte_size:bytes.length,sha256:sha,quarantine_path:qpath,status:"QUARANTINED",
 }).select("id").maybeSingle();
 if(inserted.error||!inserted.data){
  await current.admin.storage.from(quarantine).remove([qpath]);
  throw new OfficeChatAttachmentError(503,"Quarantined attachment metadata unavailable");
 }
 await recordEvent(current.admin,{id,actor:current.identity.userId,kind:"QUARANTINED"});
 return advanceScan(id);
}
export async function retryOfficeChatAttachment(id:string){return advanceScan(id);}
export async function getOfficeChatSharedFiles(){
 const memberships=await listOfficeChatConversations();
 const ids=memberships.conversations.map(row=>row.id);
 if(!ids.length)return {files:[]};
 const {requireOfficeActor}=await import("@/lib/office/permission-engine");
 const current=await requireOfficeActor();
 const {data,error}=await current.admin.from("office_chat_attachment_objects")
  .select("id,conversation_id,message_id,original_filename,detected_mime_type,byte_size,created_at")
  .in("conversation_id",ids).not("message_id","is",null).eq("status","CLEAN")
  .order("created_at",{ascending:false}).limit(150);
 if(error)throw new OfficeChatAttachmentError(503,"Permitted attachment list unavailable");
 return {files:data??[]};
}
export async function downloadOfficeChatAttachment(id:string){
 const {current,attachment}=await requireOfficeChatConversationForAttachment(id);
 if(attachment.status!=="CLEAN"||!attachment.message_id||!attachment.released_path)
  throw new OfficeChatAttachmentError(404,"Attachment unavailable");
 const downloaded=await current.admin.storage.from(released).download(attachment.released_path);
 if(downloaded.error||!downloaded.data)
  throw new OfficeChatAttachmentError(503,"Private attachment bytes are unavailable");
 const bytes=Buffer.from(await downloaded.data.arrayBuffer());
 if(bytes.length!==Number(attachment.byte_size)||
   createHash("sha256").update(bytes).digest("hex")!==attachment.sha256)
  throw new OfficeChatAttachmentError(500,"Attachment integrity verification failed");
 await recordEvent(current.admin,{id,actor:current.identity.userId,kind:"DOWNLOADED"});
 return {bytes,mime:attachment.detected_mime_type,filename:attachment.original_filename};
}
