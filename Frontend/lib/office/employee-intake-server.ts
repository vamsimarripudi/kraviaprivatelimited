import "server-only";

import { createCipheriv, randomBytes } from "node:crypto";
import { OfficePermissionError, requireOfficeActor, resolveOfficePermission } from "@/lib/office/permission-engine";
import type { OfficeIdentity } from "@/lib/office/auth-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export class EmployeeIntakeError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "EmployeeIntakeError"; }
}
type Actor = { admin: SupabaseClient; identity: OfficeIdentity };
type Education = { qualification: string; institution: string; year?: number; course?: string };
type Address = { street?: string; city?: string; state?: string; postal_code?: string; country?: string };
type Draft = {
  legal_name: string; preferred_name?: string; contact_phone: string; date_of_birth?: string;
  current_address: Address; education: Education[];
  bank_account?: string; bank_account_holder?: string; bank_ifsc?: string;
  signature_evidence_reference?: string;
  policy_acknowledged: boolean;
};

async function actor() {
  try { return await requireOfficeActor(); }
  catch (error) { throw new EmployeeIntakeError(error instanceof OfficePermissionError ? error.status : 503,
    error instanceof OfficePermissionError ? error.message : "Trusted Office identity service unavailable"); }
}
function check(error: {message?:string}|null, message: string) { if (error) throw new EmployeeIntakeError(503,message); }
async function reviewer(current: Actor, employeeId: string, permission: string) {
  if (current.identity.userId === employeeId) throw new EmployeeIntakeError(403,"Independent reviewer required");
  const { data, error } = await current.admin.from("office_identity_users")
    .select("user_id,primary_department,status").eq("user_id",employeeId).maybeSingle();
  check(error, "Cannot verify employee department");
  if (!data || data.status !== "ACTIVE") throw new EmployeeIntakeError(404, "Active Office employee not found");
  const verdict = await resolveOfficePermission(current.admin,current.identity,permission,{
    type: "DEPARTMENT", key: data.primary_department || "EXECUTIVE",
  });
  if (!verdict.allowed) throw new EmployeeIntakeError(403,verdict.reason);
}
function sealBankAccount(account: string) {
  const rawKey = process.env.OFFICE_EMPLOYEE_DATA_ENCRYPTION_KEY?.trim();
  const key = rawKey ? Buffer.from(rawKey,"base64") : null;
  if (!key || key.length!==32) throw new EmployeeIntakeError(503,"Encrypted bank-data service is not configured");
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([cipher.update(account,"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
async function log(current: Actor, employeeId: string, event: string, metadata: Record<string,unknown> = {}) {
  const { error } = await current.admin.from("office_employee_intake_events").insert({
    actor_user_id:current.identity.userId,employee_user_id:employeeId,event_type:event,metadata,
  });
  check(error,"Unable to retain audited onboarding decision");
}

export async function employeeIntakeOverview(employeeId?: string) {
  const current = await actor(), id=employeeId || current.identity.userId;
  if (id !== current.identity.userId) await reviewer(current,id,"people.update");
  const [profile, reference, employment, identity] = await Promise.all([
    current.admin.from("office_employee_intake_profiles").select(
      "legal_name,preferred_name,contact_phone,date_of_birth,current_address,education,certificates,bank_account_last4,bank_ifsc,bank_account_holder,bank_verified_at,bank_verification_evidence,photo_storage_reference,signature_evidence_reference,policy_acknowledged_at,status,submitted_at,reviewed_by,reviewed_at,review_note,revision"
    ).eq("employee_user_id",id).maybeSingle(),
    current.admin.from("office_employee_reference_ids").select("reference_code,issued_at").eq("employee_user_id",id).maybeSingle(),
    current.admin.from("office_employment_registry").select("employment_code,status,start_date,relationship_type")
      .eq("identity_user_id",id).order("created_at",{ascending:false}).limit(1),
    current.admin.from("office_identity_users").select("display_name,job_title,primary_department,status")
      .eq("user_id",id).maybeSingle(),
  ]);
  for(const x of [profile,reference,employment,identity])check(x.error,"Employee intake record is unavailable");
  if(!identity.data)throw new EmployeeIntakeError(404,"Employee identity does not exist");
  return {
    employee_user_id:id,self:id===current.identity.userId,
    identity:identity.data,employment:employment.data?.[0]||null,
    profile:profile.data || null,
    permanent_employee_id:reference.data?.reference_code || null,
    issued_at:reference.data?.issued_at || null,
    bank_encryption_available:Boolean(process.env.OFFICE_EMPLOYEE_DATA_ENCRYPTION_KEY),
    note:"Raw banking values, confidential scans and passwords are never included in this response. An issued ID is permanent; a salary, signature or bank credit is never inferred.",
  };
}

export async function saveEmployeeIntake(input: Draft) {
  const current=await actor(), id=current.identity.userId;
  const old=await current.admin.from("office_employee_intake_profiles")
    .select("status,revision,bank_account_ciphertext,bank_account_last4,bank_verified_at,bank_account_holder,bank_ifsc,signature_evidence_reference,policy_acknowledged_at")
    .eq("employee_user_id",id).maybeSingle();
  check(old.error,"Cannot read current onboarding state");
  if(old.data?.status==="SUBMITTED"||old.data?.status==="VERIFIED"){
    throw new EmployeeIntakeError(409,"Submitted and verified onboarding requires an independent return before editing");
  }
  const bank = input.bank_account?.replace(/\s|-/g,"");
  if(bank && !/^[0-9]{8,24}$/.test(bank))throw new EmployeeIntakeError(400,"Bank account format is invalid");
  const encrypted=bank?sealBankAccount(bank):old.data?.bank_account_ciphertext??null;
  const data = {
    employee_user_id:id,
    legal_name:input.legal_name.trim(),
    preferred_name:input.preferred_name?.trim()||null,
    contact_phone:input.contact_phone.trim(),
    date_of_birth:input.date_of_birth||null,
    current_address:input.current_address||{},
    education:input.education,
    bank_account_ciphertext:encrypted,
    bank_account_last4:bank?bank.slice(-4):old.data?.bank_account_last4??null,
    bank_account_holder:input.bank_account_holder?.trim()||old.data?.bank_account_holder||null,
    bank_ifsc:input.bank_ifsc?.trim().toUpperCase()||old.data?.bank_ifsc||null,
    signature_evidence_reference:input.signature_evidence_reference?.trim()||old.data?.signature_evidence_reference||null,
    policy_acknowledged_at:input.policy_acknowledged?(old.data?.policy_acknowledged_at||new Date().toISOString()):null,
    // A change of bank credentials invalidates the old Finance verification.
    ...(bank?{bank_verified_by:null,bank_verified_at:null,bank_verification_evidence:null}:{}),
    status:"DRAFT",reviewed_by:null,reviewed_at:null,review_note:null,
    revision:(old.data?.revision||0)+1,updated_at:new Date().toISOString(),
  };
  const {error}=await current.admin.from("office_employee_intake_profiles")
    .upsert(data,{onConflict:"employee_user_id"});
  check(error,"Unable to securely save employee onboarding draft");
  await log(current,id,"PROFILE_DRAFT_SAVED",{revision:data.revision});
  return {saved:true,status:"DRAFT",revision:data.revision};
}

export async function submitEmployeeIntake() {
  const current=await actor(),id=current.identity.userId;
  const row=await current.admin.from("office_employee_intake_profiles")
    .select("legal_name,contact_phone,education,bank_account_ciphertext,bank_ifsc,photo_storage_reference,signature_evidence_reference,policy_acknowledged_at,status")
    .eq("employee_user_id",id).maybeSingle();
  check(row.error,"Unable to verify intake readiness");
  const p=row.data;
  if(!p||!["DRAFT","RETURNED"].includes(p.status))throw new EmployeeIntakeError(409,"No editable employee onboarding draft");
  if(!p.legal_name||!p.contact_phone||!Array.isArray(p.education)||!p.education.length||
    !p.bank_account_ciphertext||!p.bank_ifsc||!p.photo_storage_reference||!p.signature_evidence_reference||
    !p.policy_acknowledged_at)throw new EmployeeIntakeError(409,
      "Complete name, phone, education, encrypted bank details, profile photo, signature reference and policy acknowledgment before submitting");
  const now=new Date().toISOString();
  const {error}=await current.admin.from("office_employee_intake_profiles")
    .update({status:"SUBMITTED",submitted_at:now,updated_at:now}).eq("employee_user_id",id).in("status",["DRAFT","RETURNED"]);
  check(error,"Unable to submit employee onboarding");
  await log(current,id,"PROFILE_SUBMITTED");
  return {submitted:true,status:"SUBMITTED"};
}

export async function reviewEmployeeIntake(input:{employeeId:string;decision:"VERIFY"|"RETURN";reason:string}){
  const current=await actor(),id=input.employeeId;
  await reviewer(current,id,"people.update");
  const row=await current.admin.from("office_employee_intake_profiles")
    .select("status,bank_verified_at,signature_evidence_reference").eq("employee_user_id",id).maybeSingle();
  check(row.error,"Unable to read employee review");
  if(row.data?.status!=="SUBMITTED")throw new EmployeeIntakeError(409,"Only submitted onboarding can be reviewed");
  if(input.decision==="VERIFY"&&(!row.data.bank_verified_at||!row.data.signature_evidence_reference)){
    throw new EmployeeIntakeError(409,"Finance bank verification and signed-document reference required");
  }
  const status=input.decision==="VERIFY"?"VERIFIED":"RETURNED";
  const {error}=await current.admin.from("office_employee_intake_profiles")
    .update({status,reviewed_by:current.identity.userId,reviewed_at:new Date().toISOString(),review_note:input.reason,updated_at:new Date().toISOString()})
    .eq("employee_user_id",id).eq("status","SUBMITTED");
  check(error,"Unable to review employee onboarding");
  await log(current,id,status==="VERIFIED"?"PROFILE_VERIFIED":"PROFILE_RETURNED",{reason:input.reason});
  return {status,reviewed:true};
}

export async function verifyEmployeeBank(input:{employeeId:string;reason:string;evidenceReference:string}){
  const current=await actor(),id=input.employeeId;
  await reviewer(current,id,"payroll.payment.prepare");
  const record=await current.admin.from("office_employee_intake_profiles")
    .select("bank_account_ciphertext,bank_ifsc,status").eq("employee_user_id",id).maybeSingle();
  check(record.error,"Bank verification record unavailable");
  if(!record.data?.bank_account_ciphertext||!record.data.bank_ifsc)
    throw new EmployeeIntakeError(409,"The employee has not securely submitted bank details");
  if(!["DRAFT","SUBMITTED","RETURNED"].includes(record.data.status))
    throw new EmployeeIntakeError(409,"Verified onboarding cannot be silently re-reviewed");
  const {error}=await current.admin.from("office_employee_intake_profiles")
    .update({bank_verified_by:current.identity.userId,bank_verified_at:new Date().toISOString(),
      bank_verification_evidence:input.evidenceReference,updated_at:new Date().toISOString()})
    .eq("employee_user_id",id);
  check(error,"Unable to record independent Finance bank verification");
  await log(current,id,"BANK_DETAILS_VERIFIED",{evidence_reference:input.evidenceReference,reason:input.reason});
  return {verified:true};
}

export async function issuePermanentEmployeeId(input:{employeeId:string;reason:string}){
  const current=await actor(),id=input.employeeId;
  await reviewer(current,id,"people.update");
  // 64-bit cryptographic suffix with DB-enforced uniqueness; no dates,
  // personal information, sequential values, or raw UUIDs are disclosed.
  const year=new Date().getUTCFullYear().toString().slice(-2);
  for(let attempt=0;attempt<5;attempt++){
    const code="KRV-E"+year+"-"+randomBytes(8).toString("hex").toUpperCase();
    const {data,error}=await current.admin.rpc("office_employee_reference_issue",{
      p_actor:current.identity.userId,p_employee:id,p_reference:code,p_reason:input.reason,
    });
    if(!error&&typeof data==="string")return {issued:true,permanent_employee_id:data,email_status:"PENDING"};
    if(error?.code==="23505")continue;
    throw new EmployeeIntakeError(409,error?.message||"Employee ID issuance blocked by verification gates");
  }
  throw new EmployeeIntakeError(503,"Unique employee ID collision; no ID was issued");
}

/** Minimal directory for authorised HR. A delegated head cannot enumerate
 * employees in an unrelated department. No banking, DOB, documents or
 * employment compensation is included. */
export async function employeeIntakeDirectory(){
  const current=await actor();
  const directory=await current.admin.from("office_identity_users")
    .select("user_id,display_name,primary_department,status")
    .eq("status","ACTIVE").order("display_name").limit(250);
  check(directory.error,"Employee directory is unavailable");
  const allowed: Array<{user_id:string;display_name:string;department:string}> = [];
  for(const person of directory.data||[]){
    const permission=await resolveOfficePermission(current.admin,current.identity,"people.update",{
      type:"DEPARTMENT",key:person.primary_department||"EXECUTIVE",
    });
    if(permission.allowed) allowed.push({
      user_id:person.user_id, display_name:person.display_name||"Office employee",
      department:person.primary_department||"UNASSIGNED",
    });
  }
  return {employees:allowed};
}
