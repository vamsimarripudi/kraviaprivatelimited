import "server-only";

import {
  OfficePermissionError,
  requireOfficeActor,
  resolveOfficePermission,
} from "@/lib/office/permission-engine";
import { currentOfficeTrustedDeviceId } from "@/lib/office/device-binding-server";

export class OfficeDomainControlError extends Error {
  constructor(public readonly status:number,message:string){super(message);this.name="OfficeDomainControlError"}
}
type Actor=Awaited<ReturnType<typeof requireOfficeActor>>;

async function actor():Promise<Actor>{
  try{return await requireOfficeActor()}catch(error){
    if(error instanceof OfficePermissionError)throw new OfficeDomainControlError(error.status,error.message);
    throw error;
  }
}
async function can(current:Actor,code:string){
  const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
  return (await resolveOfficePermission(current.admin,current.identity,code,{type:"COMPANY"},device)).allowed;
}
function fail(error:{message?:string}|null,message:string){if(error)throw new OfficeDomainControlError(503,error.message||message)}

export async function getDomainControlOverview(){
  const current=await actor();
  const capabilities={
    read:await can(current,"infra.domain.read"),
    manage:await can(current,"infra.domain.manage"),
    dns_propose:await can(current,"infra.dns.propose"),
    dns_review:await can(current,"infra.dns.review"),
    dns_verify:await can(current,"infra.dns.verify"),
  };
  if(!Object.values(capabilities).some(Boolean))throw new OfficeDomainControlError(403,"Domain and certificate control is not assigned to your current authority");

  const [domains,dnsChanges,certificates,people,services]=await Promise.all([
    current.admin.from("office_corporate_domains")
      .select("id,domain_code,domain_name,registrar_name,dns_provider_name,registered_on,expires_on,auto_renew,owner_user_id,renewal_reference,status,created_by,created_at,updated_at")
      .order("domain_name").limit(500),
    current.admin.from("office_dns_changes")
      .select("id,change_code,domain_id,record_name,record_type,expected_value_sha256,ttl_seconds,provider_record_reference,purpose,status,proposed_by,approved_by,approved_at,applied_by,applied_at,apply_evidence_reference,verified_by,verified_at,observed_value_sha256,verification_evidence_reference,created_at,updated_at")
      .order("created_at",{ascending:false}).limit(1500),
    current.admin.from("office_tls_certificates")
      .select("id,certificate_code,domain_id,service_id,hostname_pattern,issuer_name,fingerprint_sha256,provider_reference,issued_at,expires_at,auto_managed,status,created_by,created_at,updated_at")
      .order("expires_at",{ascending:true}).limit(1000),
    capabilities.manage||capabilities.dns_propose||capabilities.dns_review||capabilities.dns_verify
      ? current.admin.from("office_identity_users").select("user_id,display_name,job_title,primary_department,status").eq("status","ACTIVE").order("display_name")
      : Promise.resolve({data:[],error:null}),
    capabilities.manage
      ? current.admin.from("office_engineering_services").select("id,service_code,name,project_key,environment,status").neq("status","RETIRED").order("name")
      : Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [domains,dnsChanges,certificates,people,services])fail(result.error,"Domain control records are temporarily unavailable");

  return {
    actor:{user_id:current.identity.userId,roles:current.identity.roles},
    capabilities,
    domains:domains.data||[],
    dns_changes:dnsChanges.data||[],
    certificates:certificates.data||[],
    people:people.data||[],
    services:services.data||[],
    disclaimer:"KRAVIA stores domain metadata, hashed DNS expectations and certificate fingerprints only. Registrar credentials, DNS API keys, raw DNS secrets and TLS private keys are not stored in this control plane.",
  };
}

export async function createDomain(input:{domain:string;registrar?:string;dnsProvider?:string;registeredOn?:string;expiresOn?:string;autoRenew:boolean;ownerUserId:string;renewalReference?:string}){
  const current=await actor();
  if(!await can(current,"infra.domain.manage"))throw new OfficeDomainControlError(403,"Domain management permission is required");
  const {data,error}=await current.admin.rpc("office_domain_create",{
    p_actor:current.identity.userId,p_domain:input.domain,p_registrar:input.registrar?.trim()||null,p_dns_provider:input.dnsProvider?.trim()||null,
    p_registered:input.registeredOn??null,p_expires:input.expiresOn??null,p_auto_renew:input.autoRenew,p_owner:input.ownerUserId,
    p_renewal_reference:input.renewalReference?.trim()||null,
  });
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to create domain");
  return {domain_id:data};
}
export async function updateDomain(input:{domainId:string;registrar?:string;dnsProvider?:string;expiresOn?:string;autoRenew:boolean;ownerUserId:string;renewalReference?:string;status:string}){
  const current=await actor();
  if(!await can(current,"infra.domain.manage"))throw new OfficeDomainControlError(403,"Domain management permission is required");
  const {data,error}=await current.admin.rpc("office_domain_update",{
    p_actor:current.identity.userId,p_domain:input.domainId,p_registrar:input.registrar?.trim()||null,p_dns_provider:input.dnsProvider?.trim()||null,
    p_expires:input.expiresOn??null,p_auto_renew:input.autoRenew,p_owner:input.ownerUserId,
    p_renewal_reference:input.renewalReference?.trim()||null,p_status:input.status,
  });
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to update domain");
  return {status:data};
}
export async function proposeDnsChange(input:{domainId:string;recordName:string;recordType:string;expectedSha256:string;ttl?:number;providerReference?:string;purpose:string}){
  const current=await actor();
  if(!await can(current,"infra.dns.propose"))throw new OfficeDomainControlError(403,"DNS proposal permission is required");
  const {data,error}=await current.admin.rpc("office_dns_change_propose",{
    p_actor:current.identity.userId,p_domain:input.domainId,p_record_name:input.recordName,p_record_type:input.recordType,
    p_expected_sha256:input.expectedSha256.toLowerCase(),p_ttl:input.ttl??null,p_provider_reference:input.providerReference?.trim()||null,p_purpose:input.purpose,
  });
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to propose DNS change");
  return {dns_change_id:data};
}
export async function reviewDnsChange(input:{changeId:string;status:string;note?:string}){
  const current=await actor();
  if(!await can(current,"infra.dns.review"))throw new OfficeDomainControlError(403,"Independent DNS review permission is required");
  const {data,error}=await current.admin.rpc("office_dns_change_review",{p_actor:current.identity.userId,p_change:input.changeId,p_status:input.status,p_note:input.note?.trim()||null});
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to review DNS change");
  return {status:data};
}
export async function markDnsApplied(input:{changeId:string;evidence:string}){
  const current=await actor();
  if(!await can(current,"infra.dns.propose"))throw new OfficeDomainControlError(403,"DNS execution-record permission is required");
  const {data,error}=await current.admin.rpc("office_dns_change_mark_applied",{p_actor:current.identity.userId,p_change:input.changeId,p_apply_evidence:input.evidence});
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to record DNS application");
  return {status:data};
}
export async function verifyDnsChange(input:{changeId:string;observedSha256:string;evidence:string}){
  const current=await actor();
  if(!await can(current,"infra.dns.verify"))throw new OfficeDomainControlError(403,"Independent DNS verification permission is required");
  const {data,error}=await current.admin.rpc("office_dns_change_verify",{p_actor:current.identity.userId,p_change:input.changeId,p_observed_sha256:input.observedSha256.toLowerCase(),p_evidence:input.evidence});
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to verify DNS change");
  return {status:data};
}
export async function recordTlsCertificate(input:{domainId:string;serviceId?:string;hostname:string;issuer:string;fingerprint:string;providerReference?:string;issuedAt?:string;expiresAt:string;autoManaged:boolean}){
  const current=await actor();
  if(!await can(current,"infra.domain.manage"))throw new OfficeDomainControlError(403,"Domain management permission is required");
  const {data,error}=await current.admin.rpc("office_tls_certificate_record",{
    p_actor:current.identity.userId,p_domain:input.domainId,p_service:input.serviceId??null,p_hostname:input.hostname,p_issuer:input.issuer,
    p_fingerprint:input.fingerprint,p_provider_reference:input.providerReference?.trim()||null,p_issued:input.issuedAt??null,p_expires:input.expiresAt,p_auto:input.autoManaged,
  });
  if(error||typeof data!=="string")throw new OfficeDomainControlError(400,error?.message||"Unable to record TLS certificate");
  return {certificate_id:data};
}
