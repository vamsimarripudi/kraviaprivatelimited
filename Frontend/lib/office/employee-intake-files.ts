import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext } from "@/lib/office/auth-server";
import { requireOfficeActor } from "@/lib/office/permission-engine";
import { EmployeeIntakeError, employeeIntakeOverview } from "@/lib/office/employee-intake-server";

const bucket = "office-employee-intake";
type FileKind = "PHOTO" | "CERTIFICATE";
function detect(bytes: Buffer): {mime:string;ext:string;photo:boolean} {
  const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(bytes.length>=8&&bytes.subarray(0,8).equals(png)) return {mime:"image/png",ext:"png",photo:true};
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff) return {mime:"image/jpeg",ext:"jpg",photo:true};
  if(bytes.length>=12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")
    return {mime:"image/webp",ext:"webp",photo:true};
  if(bytes.length>=5&&bytes.toString("ascii",0,5)==="%PDF-") return {mime:"application/pdf",ext:"pdf",photo:false};
  throw new EmployeeIntakeError(400,"Only valid JPEG/PNG/WebP photos or PDF certificates are accepted");
}
async function scan(bytes:Buffer,mime:string) {
  const origin=getOfficeRuntimeOrigin();
  if(!origin) throw new EmployeeIntakeError(503,"Office security scanner is not configured");
  const current=await getOfficeSessionContext();
  if(!current||current.identity.aal!=="aal2")throw new EmployeeIntakeError(403,"Verified MFA required");
  let response:Response;
  try{
    response=await fetch(new URL("/api/v1/security/file-scan",origin),{
      method:"POST",
      headers:{Authorization:"Bearer "+current.session.access_token,"Content-Type":mime,"Content-Length":String(bytes.length)},
      body:new Uint8Array(bytes),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(35_000),
    });
  }catch{throw new EmployeeIntakeError(503,"Malware scanner unavailable; no file was stored");}
  if(response.status===422)throw new EmployeeIntakeError(400,"Security scanner rejected this file");
  if(!response.ok)throw new EmployeeIntakeError(503,"File scan not confirmed; no file was stored");
  const verdict=await response.json().catch(()=>null) as {clean?:boolean;sha256?:string;byte_size?:number}|null;
  const digest=createHash("sha256").update(bytes).digest("hex");
  if(verdict?.clean!==true||verdict.sha256!==digest||verdict.byte_size!==bytes.length)
    throw new EmployeeIntakeError(503,"Security scan integrity mismatch; no file was stored");
  return digest;
}
export async function uploadEmployeeIntakeFile(input:{file:File;kind:FileKind;label?:string}) {
  const {admin,identity}=await requireOfficeActor();
  const state=await employeeIntakeOverview();
  if(!state.profile||!["DRAFT","RETURNED"].includes(state.profile.status))
    throw new EmployeeIntakeError(409,"Save your editable onboarding draft before uploading evidence");
  if(input.file.size===0||input.file.size>(input.kind==="PHOTO"?2_097_152:10_485_760))
    throw new EmployeeIntakeError(413,"Photo must be under 2 MiB; certificate under 10 MiB");
  const bytes=Buffer.from(await input.file.arrayBuffer());
  const detected=detect(bytes);
  if(input.kind==="PHOTO"&&!detected.photo)throw new EmployeeIntakeError(400,"Profile photo must be JPEG, PNG or WebP");
  if(input.kind==="CERTIFICATE"&&detected.mime!=="application/pdf")
    throw new EmployeeIntakeError(400,"Course certificates must be reviewed PDF files");
  if(input.file.type&&input.file.type!==detected.mime)
    throw new EmployeeIntakeError(400,"File MIME does not match its contents");
  const sha=await scan(bytes,detected.mime);
  const storagePath=identity.userId+"/"+randomUUID()+"."+detected.ext;
  const uploaded=await admin.storage.from(bucket).upload(storagePath,bytes,{
    contentType:detected.mime,upsert:false,cacheControl:"0",
  });
  if(uploaded.error)throw new EmployeeIntakeError(503,"Private employee document storage unavailable");
  const old=await admin.from("office_employee_intake_profiles")
    .select("status,certificates,revision").eq("employee_user_id",identity.userId).maybeSingle();
  if(old.error||!old.data||!["DRAFT","RETURNED"].includes(old.data.status)){
    await admin.storage.from(bucket).remove([storagePath]);
    throw new EmployeeIntakeError(409,"Employee onboarding changed during upload; private file removed");
  }
  const items=Array.isArray(old.data.certificates)?old.data.certificates:[];
  if(input.kind==="CERTIFICATE"&&(items.length>=25||!input.label?.trim())){
    await admin.storage.from(bucket).remove([storagePath]);
    throw new EmployeeIntakeError(400,"A certificate label is required; maximum 25 certificates");
  }
  const update=input.kind==="PHOTO" ? {photo_storage_reference:storagePath} : {
    certificates:[...items,{label:input.label?.trim().slice(0,140),storage_reference:storagePath,
      sha256:sha,mime_type:detected.mime,byte_size:bytes.length,review_status:"PENDING"}],
  };
  const persisted=await admin.from("office_employee_intake_profiles")
    .update({...update,revision:old.data.revision+1,updated_at:new Date().toISOString()})
    .eq("employee_user_id",identity.userId).eq("revision",old.data.revision)
    .in("status",["DRAFT","RETURNED"]).select("employee_user_id").maybeSingle();
  if(persisted.error||!persisted.data) {
    await admin.storage.from(bucket).remove([storagePath]);
    throw new EmployeeIntakeError(409,"Private document metadata could not be verified; upload removed");
  }
  const {error:auditError}=await admin.from("office_employee_intake_events").insert({
    employee_user_id:identity.userId,actor_user_id:identity.userId,
    event_type:input.kind==="PHOTO"?"PHOTO_SCANNED":"CERTIFICATE_SCANNED",
    metadata:{sha256:sha,mime_type:detected.mime,byte_size:bytes.length},
  });
  if(auditError)throw new EmployeeIntakeError(503,"Document stored but audit recording needs review");
  return {scanned:true,stored:true,kind:input.kind,reference:storagePath};
}

export async function readEmployeePhoto(employeeId?:string){
  const state=await employeeIntakeOverview(employeeId);
  const path=state.profile?.photo_storage_reference;
  if(!path)return null;
  if(!path.startsWith(state.employee_user_id+"/")||!/^[0-9a-f-]+\.(png|jpg|webp)$/.test(path.split("/")[1]||""))
    throw new EmployeeIntakeError(409,"Stored private photo reference is invalid");
  const {admin}=await requireOfficeActor();
  const result=await admin.storage.from(bucket).download(path);
  if(result.error||!result.data)throw new EmployeeIntakeError(503,"Private profile photo unavailable");
  return {bytes:await result.data.arrayBuffer(),mime:result.data.type||"image/png"};
}
