import "server-only";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { createOfficeAdminClient } from "@/lib/supabase/admin";
import { careerMailConfigured, sendCareerNotice, type CareerNoticeKind } from "@/lib/careers/mail";

export class CareerError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "CareerError"; }
}
type CareerAdmin = NonNullable<ReturnType<typeof createOfficeAdminClient>>;
type PublicJob = {
  id: string; requisitionId: string; slug: string; title: string;
  summary: string; description: string; requirements: string; benefits: string;
  department: string; employmentType: string; workMode: string;
  location: string; openings: number; expiresAt: string | null; publishedAt: string;
};
type Applicant = {
  id: string; application_code: string; full_name: string; email: string;
  requisition_id: string; candidate_id: string | null; status: string;
  created_at: string; publication_id: string;
};
const BUCKET = "office-career-quarantine";
export function careerAdmin(): CareerAdmin {
  const admin = createOfficeAdminClient();
  if (!admin) throw new CareerError(503, "Secure recruitment database is unavailable");
  return admin;
}
export function digestToken(raw: string): string { return createHash("sha256").update(raw).digest("hex"); }
function newToken(): string { return randomBytes(32).toString("base64url"); }
function assertDatabase(error: { message?: string } | null, message: string): void {
  if (error) throw new CareerError(503, message);
}
function normalizedEmail(email: string) { return email.trim().toLowerCase(); }

export async function listPublicCareerJobs(): Promise<PublicJob[]> {
  const admin = careerAdmin();
  const time = new Date().toISOString();
  const publications = await admin.from("office_career_publications")
    .select("id,requisition_id,slug,title,summary,description,requirements,benefits,expires_at,published_at")
    .eq("status","PUBLISHED").or("expires_at.is.null,expires_at.gt." + time)
    .order("published_at",{ascending:false}).limit(100);
  assertDatabase(publications.error,"Published jobs cannot be verified");
  const ids = (publications.data ?? []).map(row => row.requisition_id);
  if (!ids.length) return [];
  const reqs = await admin.from("office_hiring_requisitions")
    .select("id,department_code,employment_type,work_mode,location_text,openings,approved_at,opened_at,closed_at")
    .in("id",ids).eq("status","OPEN").not("approved_at","is",null).not("opened_at","is",null).is("closed_at",null);
  assertDatabase(reqs.error,"Hiring approvals cannot be verified");
  const allowed = new Map((reqs.data ?? []).map(row => [row.id,row]));
  return (publications.data ?? []).flatMap(pub => {
    const req = allowed.get(pub.requisition_id);
    return req ? [{
      id: pub.id, requisitionId: req.id, slug: pub.slug, title: pub.title,
      summary: pub.summary, description: pub.description, requirements: pub.requirements,
      benefits: pub.benefits, department: req.department_code,
      employmentType: req.employment_type, workMode: req.work_mode,
      location: req.location_text || "Location specified by HR",
      openings: req.openings, expiresAt: pub.expires_at,publishedAt:pub.published_at,
    } satisfies PublicJob] : [];
  });
}
export async function getPublicCareerJob(slug: string): Promise<PublicJob | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>100) return null;
  return (await listPublicCareerJobs()).find(job => job.slug === slug) || null;
}
export async function consumeCareerRateLimit(email: string, request: Request, max=8): Promise<void> {
  const secret = process.env.KRAVIA_CAREERS_RATE_SECRET || process.env.KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new CareerError(503,"Application abuse protection is not configured");
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const fingerprints = [
    createHmac("sha256",secret).update("career-ip:" + ip).digest("hex"),
    createHmac("sha256",secret).update("career-email:" + normalizedEmail(email)).digest("hex"),
  ];
  const admin=careerAdmin();
  for (const fingerprint of fingerprints) {
    const { data,error } = await admin.rpc("office_career_rate_consume", { p_fingerprint: fingerprint, p_max: max });
    if (error) throw new CareerError(503, "Recruitment abuse-control service is unavailable");
    if (data !== true) throw new CareerError(429,"Too many requests; try again later");
  }
}
async function recordMail(admin: CareerAdmin, application: Applicant, kind: CareerNoticeKind, token?: string) {
  const created=await admin.from("office_career_email_events")
    .insert({ application_id:application.id,event_type:kind,recipient_email:application.email,status:"PENDING" })
    .select("id").single();
  assertDatabase(created.error,"Unable to retain communication audit event");
  const result=await sendCareerNotice({
    kind,name:application.full_name,email:application.email,reference:application.application_code,token,
  });
  const updated=await admin.from("office_career_email_events")
    .update({status:result.outcome,provider_message_id:result.providerId||null,error_category:result.category||null,completed_at:new Date().toISOString()})
    .eq("id",created.data.id);
  assertDatabase(updated.error,"Communication delivery outcome could not be recorded");
  return result;
}
async function addVerificationToken(admin: CareerAdmin, appId: string, purpose: "VERIFY"|"LOGIN") {
  const token = newToken();
  const hashed = digestToken(token);
  const expiresAt = new Date(Date.now()+30*60*1000).toISOString();
  const saved=await admin.from("office_career_tokens")
    .insert({ token_hash:hashed, application_id:appId, purpose, expires_at:expiresAt });
  assertDatabase(saved.error,"Unable to create secure candidate verification");
  return token;
}
async function saveQuarantinedResume(admin: CareerAdmin, applicationId: string, file: File) {
  if (file.size < 100 || file.size > 4_194_304 || file.type !== "application/pdf") {
    throw new CareerError(400,"Resume must be a PDF up to 4 MB");
  }
  const bytes=Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0,5).toString("ascii")!=="%PDF-") throw new CareerError(400,"Resume content must be a valid PDF");
  const sha=createHash("sha256").update(bytes).digest("hex");
  const path=applicationId + "/" + randomUUID() + ".pdf";
  const uploaded=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:"application/pdf",cacheControl:"0",upsert:false});
  if (uploaded.error) throw new CareerError(503,"Private resume quarantine is unavailable");
  const updated=await admin.from("office_career_applications").update({
    resume_path:path,resume_sha256:sha,resume_scan_status:"QUARANTINED",
    resume_mime:"application/pdf",resume_bytes:bytes.length,
    resume_filename:file.name.replace(/[^\w.() -]/g,"_").slice(0,180),
    updated_at:new Date().toISOString(),
  }).eq("id",applicationId);
  if (updated.error) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new CareerError(503,"Private resume metadata could not be recorded");
  }
}
export async function submitCareerApplication(input: {
  jobSlug:string; fullName:string; email:string; phone?:string; location?:string; note?:string;
  privacyAccepted:boolean; communicationRequested:boolean; honeypot?:string; resume?:File|null;
}, request:Request): Promise<{ accepted:true;reference?:string }> {
  if (input.honeypot) return {accepted:true};
  if (!input.privacyAccepted) throw new CareerError(400,"Review and accept the recruitment privacy notice");
  if (!careerMailConfigured()) throw new CareerError(503,"Recruitment email verification is temporarily unavailable");
  const job=await getPublicCareerJob(input.jobSlug);
  if (!job) throw new CareerError(404,"This vacancy is not currently open for applications");
  const email=normalizedEmail(input.email);
  await consumeCareerRateLimit(email,request,8);
  const admin=careerAdmin();
  let app: Applicant;
  const existing=await admin.from("office_career_applications")
    .select("id,application_code,full_name,email,requisition_id,candidate_id,status,created_at,publication_id")
    .eq("requisition_id",job.requisitionId).eq("email",email).maybeSingle();
  assertDatabase(existing.error,"Unable to verify existing application");
  if (existing.data && existing.data.status !== "PENDING_EMAIL") return { accepted:true };
  if (existing.data) {
    if (Date.now()-new Date(existing.data.created_at).getTime()<120000) return { accepted:true };
    app=existing.data as Applicant;
  } else {
    const id=randomUUID();
    const saved=await admin.from("office_career_applications").insert({
      id, publication_id:job.id,requisition_id:job.requisitionId,
      full_name:input.fullName.trim(),email,phone:input.phone?.trim()||null,
      location_text:input.location?.trim()||null,cover_note:input.note?.trim()||null,
      privacy_notice_version:"KRAVIA-RECRUITMENT-2026-11",
      privacy_accepted_at:new Date().toISOString(),
      communication_requested:input.communicationRequested,status:"PENDING_EMAIL",
    }).select("id,application_code,full_name,email,requisition_id,candidate_id,status,created_at,publication_id").single();
    if (saved.error || !saved.data) {
      // A simultaneous identical submission may be legitimately deduplicated.
      if (saved.error?.code==="23505") return { accepted:true };
      throw new CareerError(503,"Application intake is currently unavailable");
    }
    app=saved.data as Applicant;
  }
  if (input.resume && !existing.data) await saveQuarantinedResume(admin,app.id,input.resume);
  const token=await addVerificationToken(admin,app.id,"VERIFY");
  const result=await recordMail(admin,app,"EMAIL_VERIFICATION",token);
  if (result.outcome!=="SENT") throw new CareerError(503,
    result.outcome==="UNKNOWN"?"Email provider response is uncertain; use application access to request a new link":
    "Verification email was not accepted; retry through application access");
  return {accepted:true,reference:app.application_code};
}
export async function requestCareerLogin(email:string,reference:string,request:Request):Promise<{ accepted:true }> {
  await consumeCareerRateLimit(email,request,6);
  const admin=careerAdmin();
  const existing=await admin.from("office_career_applications")
    .select("id,application_code,full_name,email,requisition_id,candidate_id,status,created_at,publication_id")
    .eq("application_code",reference.trim().toUpperCase()).eq("email",normalizedEmail(email)).maybeSingle();
  assertDatabase(existing.error,"Application lookup is unavailable");
  const app=existing.data as Applicant|null;
  // Generic success on unknown/withdrawn references prevents account enumeration.
  if (!app || !["PENDING_EMAIL","VERIFIED","IMPORTED","REJECTED"].includes(app.status) || !careerMailConfigured()) return {accepted:true};
  const purpose=app.status==="PENDING_EMAIL"?"VERIFY":"LOGIN";
  const token=await addVerificationToken(admin,app.id,purpose);
  await recordMail(admin,app,purpose==="VERIFY"?"EMAIL_VERIFICATION":"ACCESS_LINK",token);
  return {accepted:true};
}
export async function verifyCareerToken(raw:string):Promise<{sessionToken:string;reference:string}> {
  if (!/^[A-Za-z0-9_-]{42,50}$/.test(raw)) throw new CareerError(400,"Verification link is invalid");
  const admin=careerAdmin(), now=new Date().toISOString();
  const consumed=await admin.from("office_career_tokens").update({used_at:now})
    .eq("token_hash",digestToken(raw)).in("purpose",["VERIFY","LOGIN"])
    .gt("expires_at",now).is("used_at",null).is("revoked_at",null)
    .select("application_id,purpose").maybeSingle();
  assertDatabase(consumed.error,"Unable to consume secure application token");
  if (!consumed.data) throw new CareerError(410,"This link is invalid, expired or already used");
  const found=await admin.from("office_career_applications")
    .select("id,application_code,full_name,email,requisition_id,candidate_id,status,created_at,publication_id")
    .eq("id",consumed.data.application_id).maybeSingle();
  assertDatabase(found.error,"Application verification unavailable");
  const app=found.data as Applicant|null;
  if (!app || app.status==="WITHDRAWN" || app.status==="ARCHIVED") throw new CareerError(410,"This application is no longer accessible");
  if (consumed.data.purpose==="VERIFY") {
    if (app.status!=="PENDING_EMAIL") throw new CareerError(409,"Application was already verified");
    const changed=await admin.from("office_career_applications")
      .update({status:"VERIFIED",verified_at:now,updated_at:now})
      .eq("id",app.id).eq("status","PENDING_EMAIL");
    assertDatabase(changed.error,"Verified application status could not be recorded");
  } else if (app.status==="PENDING_EMAIL") throw new CareerError(403,"Verify your email before accessing your application");
  const token=newToken();
  const issued=await admin.from("office_career_tokens").insert({
    token_hash:digestToken(token),application_id:app.id,purpose:"SESSION",
    expires_at:new Date(Date.now()+7*86400000).toISOString()
  });
  assertDatabase(issued.error,"Private candidate session could not be created");
  if (consumed.data.purpose==="VERIFY") await recordMail(admin,app,"APPLICATION_RECEIPT");
  return {sessionToken:token,reference:app.application_code};
}
async function sessionApplication(session:string):Promise<{admin:CareerAdmin;app:Applicant}> {
  if (!/^[A-Za-z0-9_-]{42,50}$/.test(session)) throw new CareerError(401,"Please request a new application access link");
  const admin=careerAdmin();
  const existing=await admin.from("office_career_tokens")
    .select("application_id").eq("token_hash",digestToken(session)).eq("purpose","SESSION")
    .is("used_at",null).is("revoked_at",null)
    .gt("expires_at",new Date().toISOString()).maybeSingle();
  assertDatabase(existing.error,"Private candidate session is unavailable");
  if (!existing.data) throw new CareerError(401,"Application session expired; request a new access link");
  const result=await admin.from("office_career_applications")
    .select("id,application_code,full_name,email,requisition_id,candidate_id,status,created_at,publication_id")
    .eq("id",existing.data.application_id).maybeSingle();
  assertDatabase(result.error,"Application record is unavailable");
  if (!result.data) throw new CareerError(404,"Application not found");
  return {admin,app:result.data as Applicant};
}
export async function getCareerPortal(session:string) {
  const {admin,app}=await sessionApplication(session);
  const [req,source]=await Promise.all([
    admin.from("office_hiring_requisitions").select("position_code,department_code,employment_type,work_mode,location_text").eq("id",app.requisition_id).maybeSingle(),
    admin.from("office_career_publications").select("title").eq("id",app.publication_id).maybeSingle(),
  ]);
  assertDatabase(req.error||source.error,"Application position unavailable");
  let candidate: { status:string;candidate_code:string }|null=null;
  let interviews: Array<{id:string; title:string; scheduled_start:string;scheduled_end:string|null;status:string;location_or_link:string|null}>=[];
  let documentRequests: Array<{id:string;label:string;status:string;required:boolean;upload_status:string|null}>=[];
  let offer: null|{id:string;offer_code:string;joining_date:string;monthly_gross_minor:number;currency:string;status:string;valid_until:string|null}=null;
  if (app.candidate_id) {
    const [c,ivs,docs,ofr,uploads]=await Promise.all([
      admin.from("office_candidates").select("status,candidate_code").eq("id",app.candidate_id).maybeSingle(),
      admin.from("office_candidate_interviews").select("id,title,scheduled_start,scheduled_end,status,location_or_link")
        .eq("candidate_id",app.candidate_id).order("scheduled_start",{ascending:false}).limit(15),
      admin.from("office_candidate_document_requests").select("id,label,status,required")
        .eq("candidate_id",app.candidate_id).order("requested_at",{ascending:false}).limit(25),
      admin.from("office_offer_proposals")
        .select("id,offer_code,joining_date,monthly_gross_minor,currency,status,valid_until,offer_document_instance_id")
        .eq("candidate_id",app.candidate_id).maybeSingle(),
      admin.from("office_career_candidate_uploads")
        .select("document_request_id,status").eq("application_id",app.id).limit(50),
    ]);
    assertDatabase(c.error||ivs.error||docs.error||ofr.error||uploads.error,"Candidate status is unavailable");
    const uploadByRequest=new Map((uploads.data||[]).map(x=>[x.document_request_id,x.status]));
    candidate=c.data;interviews=ivs.data??[];
    documentRequests=(docs.data??[]).map(d=>({...d,upload_status:uploadByRequest.get(d.id)||null}));
    if (ofr.data && ["OFFERED","ACCEPTED","ONBOARDING","HIRED"].includes(ofr.data.status) && ofr.data.offer_document_instance_id) {
      const delivered=await admin.from("office_document_instances")
        .select("delivered_at,status").eq("id",ofr.data.offer_document_instance_id).maybeSingle();
      assertDatabase(delivered.error,"Official offer delivery state is unavailable");
      if (delivered.data?.delivered_at) offer={
        id:ofr.data.id,offer_code:ofr.data.offer_code,joining_date:ofr.data.joining_date,
        monthly_gross_minor:ofr.data.monthly_gross_minor,currency:ofr.data.currency,
        status:ofr.data.status==="DOCUMENT_READY"?"OFFERED":ofr.data.status,valid_until:ofr.data.valid_until,
      };
    }
  }
  const actions=await admin.from("office_career_candidate_actions")
    .select("id,interview_id,offer_id,action_type,status,created_at")
    .eq("application_id",app.id).order("created_at",{ascending:false}).limit(30);
  assertDatabase(actions.error,"Candidate actions unavailable");
  return {
    reference:app.application_code,name:app.full_name,email:app.email,
    status:app.status,stage:candidate?.status||"AWAITING_HR_REVIEW",
    candidate_reference:candidate?.candidate_code||null,
    role:source.data?.title||req.data?.position_code||"Role",department:req.data?.department_code||"",
    interviews,requested_documents:documentRequests,offer,actions:actions.data??[],
    notice:"An accepted offer is not an employee appointment. HR independently verifies signed documents, identity, joining date, bank information and permissions before activation.",
  };
}
export async function submitCareerPortalAction(session:string,input:{
 action:"WITHDRAWAL"|"INTERVIEW_CONFIRMATION"|"RESCHEDULE_REQUEST"|"OFFER_ACKNOWLEDGED";
 interview_id?:string;offer_id?:string;note?:string;typed_name?:string;
}):Promise<{ok:true;message:string}> {
  const {admin,app}=await sessionApplication(session);
  if (app.status==="WITHDRAWN" || app.status==="ARCHIVED") throw new CareerError(409,"This application is closed");
  if (input.action==="WITHDRAWAL") {
    const updated=await admin.from("office_career_applications")
      .update({status:"WITHDRAWN",updated_at:new Date().toISOString()})
      .eq("id",app.id).in("status",["VERIFIED","IMPORTED","REJECTED"]).select("id").maybeSingle();
    assertDatabase(updated.error,"Unable to record withdrawal");
    if (!updated.data) throw new CareerError(409,"Application cannot be withdrawn at this stage");
    const event=await admin.from("office_career_candidate_actions").insert({
      application_id:app.id,candidate_id:app.candidate_id,action_type:"WITHDRAWAL",
      note:"Candidate requested withdrawal from verified session",
    });
    assertDatabase(event.error,"Unable to audit withdrawal request");
    await recordMail(admin,app,"WITHDRAWAL_RECEIPT");
    return {ok:true,message:"Withdrawal requested. HR will close any linked internal application."};
  }
  if (!app.candidate_id) throw new CareerError(409,"HR must first receive your verified application");
  if (input.action==="INTERVIEW_CONFIRMATION"||input.action==="RESCHEDULE_REQUEST") {
    const interview=await admin.from("office_candidate_interviews")
      .select("id,status").eq("id",input.interview_id).eq("candidate_id",app.candidate_id).maybeSingle();
    assertDatabase(interview.error,"Interview status unavailable");
    if (!interview.data||interview.data.status!=="SCHEDULED") throw new CareerError(409,"No active interview found");
    const event=await admin.from("office_career_candidate_actions").insert({
      application_id:app.id,candidate_id:app.candidate_id,interview_id:interview.data.id,
      action_type:input.action,note:input.note?.trim().slice(0,1000)||"Candidate confirmed scheduled interview",
    });
    assertDatabase(event.error,"Unable to record interview response");
    return {ok:true,message:input.action==="RESCHEDULE_REQUEST"?"Rescheduling request recorded for HR review":"Interview confirmation recorded"};
  }
  if (input.action==="OFFER_ACKNOWLEDGED") {
    const legalName=app.full_name.replace(/\s+/g," ").trim().toLowerCase();
    const typed=(input.typed_name||"").replace(/\s+/g," ").trim().toLowerCase();
    if (!typed||typed!==legalName) throw new CareerError(400,"Type the full application name to acknowledge the offer");
    const offer=await admin.from("office_offer_proposals")
      .select("id,status,valid_until,offer_document_instance_id").eq("id",input.offer_id).eq("candidate_id",app.candidate_id).maybeSingle();
    assertDatabase(offer.error,"Offer status unavailable");
    if (!offer.data || !["DOCUMENT_READY","OFFERED"].includes(offer.data.status) ||
      (offer.data.valid_until && new Date(offer.data.valid_until).getTime() <= Date.now()) ||
      !offer.data.offer_document_instance_id) throw new CareerError(409,"An active delivered offer is required");
    const doc=await admin.from("office_document_instances").select("delivered_at")
      .eq("id",offer.data.offer_document_instance_id).maybeSingle();
    assertDatabase(doc.error,"Offer delivery proof unavailable");
    if (!doc.data?.delivered_at) throw new CareerError(409,"HR has not delivered the approved offer");
    const evidence=createHash("sha256").update(app.id+"|"+offer.data.id+"|"+typed+"|"+new Date().toISOString()).digest("hex");
    const created=await admin.from("office_career_candidate_actions").insert({
      application_id:app.id,candidate_id:app.candidate_id,offer_id:offer.data.id,
      action_type:"OFFER_ACKNOWLEDGED",typed_name:app.full_name,evidence_sha256:evidence,
      note:"Candidate acknowledgement requires HR verification; not a provider-verified e-signature",
    });
    if (created.error) {
      if (created.error.code==="23505") return {ok:true,message:"Offer response already recorded for HR review"};
      throw new CareerError(503,"Unable to retain offer response");
    }
    await recordMail(admin,app,"OFFER_ACKNOWLEDGEMENT");
    return {ok:true,message:"Your response was recorded. HR must validate any required signed evidence before onboarding."};
  }
  throw new CareerError(400,"Unsupported candidate action");
}
