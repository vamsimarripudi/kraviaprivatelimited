import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getOfficeRuntimeOrigin } from "@/lib/env/office";
import { getOfficeSessionContext } from "@/lib/office/auth-server";
import { CareerError, careerAdmin, getCareerPortal } from "@/lib/careers/server";
import { requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";

const BUCKET = "office-career-quarantine";
const MAX_SIZE = 4_194_304;
type FileInfo = { mime:string; extension:string };
function checkFile(bytes:Buffer, claimed:string):FileInfo {
  const pdf=bytes.length>=5 && bytes.subarray(0,5).toString("ascii")==="%PDF-";
  const jpg=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const actual=pdf?"application/pdf":jpg?"image/jpeg":png?"image/png":null;
  if(!actual || actual!==claimed)throw new CareerError(400,"Allowed files: PDF, JPEG or PNG with matching file contents");
  return {mime:actual,extension:pdf?"pdf":jpg?"jpg":"png"};
}
export async function submitCareerCandidateDocument(sessionToken:string,requestId:string,file:File):Promise<{status:string}> {
  // A portal session is scoped to exactly one applicant; do not accept
  // application_id/candidate_id from the browser for authorization.
  const portal=await getCareerPortal(sessionToken);
  if(!portal.candidate_reference)throw new CareerError(403,"HR must verify the application before requesting documents");
  if(portal.status==="WITHDRAWN"||portal.status==="ARCHIVED")throw new CareerError(403,"Application is closed");
  const request=portal.requested_documents.find(x=>x.id===requestId);
  if(!request || !["REQUESTED","REJECTED"].includes(request.status))
    throw new CareerError(409,"This document was not requested or is not eligible for resubmission");
  if(file.size<100 || file.size>MAX_SIZE)throw new CareerError(413,"Candidate document must be at least 100 bytes and no larger than 4 MB");
  const admin=careerAdmin();
  const application=await admin.from("office_career_applications")
    .select("id,candidate_id,status")
    .eq("application_code",portal.reference).maybeSingle();
  if(application.error||!application.data?.candidate_id)throw new CareerError(503,"Applicant identity could not be verified");
  const candidate=await admin.from("office_candidate_document_requests")
    .select("id,candidate_id,status").eq("id",requestId).eq("candidate_id",application.data.candidate_id).maybeSingle();
  if(candidate.error||!candidate.data||!["REQUESTED","REJECTED"].includes(candidate.data.status))
    throw new CareerError(409,"Candidate document request is not current");
  const prior=await admin.from("office_career_candidate_uploads")
    .select("id,path,status")
    .eq("application_id",application.data.id).eq("document_request_id",requestId).maybeSingle();
  if(prior.error)throw new CareerError(503,"Previous submission status cannot be verified");
  if(prior.data&&prior.data.status!=="REJECTED")
    throw new CareerError(409,"This document is already awaiting HR review");
  const bytes=Buffer.from(await file.arrayBuffer());
  const type=checkFile(bytes,file.type);
  const path=application.data.id+"/"+randomUUID()+"."+type.extension;
  const digest=createHash("sha256").update(bytes).digest("hex");
  const stored=await admin.storage.from(BUCKET).upload(path,bytes,{
    contentType:type.mime,upsert:false,cacheControl:"0",
  });
  if(stored.error)throw new CareerError(503,"Secure candidate upload is unavailable");
  const record={
    application_id:application.data.id,candidate_id:application.data.candidate_id,
    document_request_id:requestId,path,sha256:digest,mime_type:type.mime,
    byte_size:bytes.length,original_filename:file.name.replace(/[^\w.() -]/g,"_").slice(0,180),
    status:"QUARANTINED",submitted_at:new Date().toISOString(),scanned_at:null,scanned_by:null,
  };
  const updated=prior.data
    ?await admin.from("office_career_candidate_uploads").update(record).eq("id",prior.data.id)
    :await admin.from("office_career_candidate_uploads").insert(record);
  if(updated.error){
    await admin.storage.from(BUCKET).remove([path]);
    throw new CareerError(503,"Candidate document was not recorded; resubmit safely");
  }
  if(prior.data?.path)await admin.storage.from(BUCKET).remove([prior.data.path]);
  return {status:"QUARANTINED"};
}
async function authorizedReview(department:string) {
  const actor=await requireOfficeActor();
  const targets=[{type:"COMPANY" as const},{type:"DEPARTMENT" as const,key:department}];
  for(const scope of targets){
    const access=await resolveOfficePermission(actor.admin,actor.identity,"hiring.candidate.manage",scope);
    if(access.allowed && (access.source==="OWNER"||access.scopeType==="COMPANY"||access.scopeKey===department))return actor;
  }
  throw new CareerError(403,"Independent HR candidate-document permission required");
}
export async function scanCareerCandidateDocument(uploadId:string):Promise<{status:string}> {
  const admin=careerAdmin();
  const upload=await admin.from("office_career_candidate_uploads")
    .select("id,application_id,candidate_id,document_request_id,path,sha256,mime_type,byte_size,original_filename,status")
    .eq("id",uploadId).maybeSingle();
  if(upload.error||!upload.data)throw new CareerError(404,"Candidate upload not found");
  if(upload.data.status!=="QUARANTINED")throw new CareerError(409,"This upload has already been processed");
  const app=await admin.from("office_career_applications").select("requisition_id")
    .eq("id",upload.data.application_id).eq("candidate_id",upload.data.candidate_id).maybeSingle();
  if(app.error||!app.data)throw new CareerError(409,"Candidate upload ownership could not be verified");
  const req=await admin.from("office_hiring_requisitions").select("department_code")
    .eq("id",app.data.requisition_id).maybeSingle();
  if(req.error||!req.data)throw new CareerError(409,"Hiring requisition unavailable");
  const actor=await authorizedReview(req.data.department_code);
  const origin=getOfficeRuntimeOrigin();
  const session=await getOfficeSessionContext();
  if(!origin||!session||session.identity.userId!==actor.identity.userId||session.identity.aal!=="aal2")
    throw new CareerError(503,"Verified AAL2 Office scanner session required");
  const fetched=await admin.storage.from(BUCKET).download(upload.data.path);
  if(fetched.error||!fetched.data)throw new CareerError(503,"Quarantined file is unavailable");
  const bytes=Buffer.from(await fetched.data.arrayBuffer());
  if(bytes.length!==upload.data.byte_size || bytes.length<100 || bytes.length>MAX_SIZE)
    throw new CareerError(409,"Quarantined file length does not match its recorded evidence");
  checkFile(bytes,upload.data.mime_type);
  const sha=createHash("sha256").update(bytes).digest("hex");
  if(sha!==upload.data.sha256)throw new CareerError(409,"Quarantined file checksum mismatch");
  let result:Response;
  try{
    result=await fetch(new URL("/api/v1/security/file-scan",origin),{
      method:"POST",headers:{
        Authorization:"Bearer "+session.session.access_token,
        "Content-Type":upload.data.mime_type,"Content-Length":String(bytes.length),
      },
      body:new Uint8Array(bytes),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(35000),
    });
  }catch{throw new CareerError(503,"File scanner unavailable; document remains quarantined");}
  if(result.status===422){
    const rejected=await admin.from("office_career_candidate_uploads").update({status:"REJECTED"})
      .eq("id",uploadId).eq("status","QUARANTINED");
    if(rejected.error)throw new CareerError(503,"Unable to retain rejected scan outcome");
    throw new CareerError(400,"Document failed malware or content inspection; candidate may resubmit");
  }
  if(!result.ok)throw new CareerError(503,"File scanner unavailable; document remains quarantined");
  const attestation=await result.json().catch(()=>null) as {clean?:boolean;sha256?:string;byte_size?:number}|null;
  if(!attestation?.clean||attestation.sha256!==sha||attestation.byte_size!==bytes.length)
    throw new CareerError(503,"File scan attestation mismatch; document remains quarantined");
  const ext=upload.data.mime_type==="application/pdf"?"pdf":upload.data.mime_type==="image/jpeg"?"jpg":"png";
  const safePath=upload.data.document_request_id+"/"+randomUUID()+"."+ext;
  const moved=await admin.storage.from("office-candidate-documents").upload(safePath,bytes,{
    contentType:upload.data.mime_type,upsert:false,cacheControl:"0",
  });
  if(moved.error)throw new CareerError(503,"Verified candidate document storage unavailable");
  const accepted=await admin.rpc("office_candidate_document_received_v2",{
    p_actor:actor.identity.userId,p_request:upload.data.document_request_id,
    p_storage:safePath,p_source:"CAREERS_SELF_SERVICE:"+upload.data.id,
    p_sha:sha,p_mime:upload.data.mime_type,p_size:bytes.length,p_filename:upload.data.original_filename,
  });
  if(accepted.error||typeof accepted.data!=="string"){
    await admin.storage.from("office-candidate-documents").remove([safePath]);
    throw new CareerError(409,accepted.error?.message||"Candidate document receipt could not be recorded");
  }
  const recorded=await admin.from("office_career_candidate_uploads")
    .update({status:"SCANNED_CLEAN",scanned_at:new Date().toISOString(),scanned_by:actor.identity.userId})
    .eq("id",uploadId).eq("status","QUARANTINED");
  if(recorded.error)throw new CareerError(503,"Scanned document status could not be retained");
  await admin.storage.from(BUCKET).remove([upload.data.path]);
  return {status:"SCANNED_CLEAN"};
}
