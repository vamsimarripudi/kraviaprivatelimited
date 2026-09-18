import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createDomain,
  getDomainControlOverview,
  markDnsApplied,
  OfficeDomainControlError,
  proposeDnsChange,
  recordTlsCertificate,
  reviewDnsChange,
  updateDomain,
  verifyDnsChange,
} from "@/lib/office/domain-control-server";

const uuid=z.string().uuid();const opt=(max:number)=>z.string().trim().max(max).optional();
const sha=z.string().regex(/^[0-9a-fA-F]{64}$/);
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_DOMAIN"),domain:z.string().trim().min(3).max(253),registrar:opt(220),dns_provider:opt(220),registered_on:z.string().date().optional(),expires_on:z.string().date().optional(),auto_renew:z.boolean(),owner_user_id:uuid,renewal_reference:opt(1200)}),
 z.object({action:z.literal("UPDATE_DOMAIN"),domain_id:uuid,registrar:opt(220),dns_provider:opt(220),expires_on:z.string().date().optional(),auto_renew:z.boolean(),owner_user_id:uuid,renewal_reference:opt(1200),status:z.enum(["ACTIVE","TRANSFER_PENDING","EXPIRING","EXPIRED","RETIRED"])}),
 z.object({action:z.literal("PROPOSE_DNS"),domain_id:uuid,record_name:z.string().trim().min(1).max(255),record_type:z.enum(["A","AAAA","CNAME","MX","TXT","SRV","CAA","NS","OTHER"]),expected_value_sha256:sha,ttl_seconds:z.number().int().min(30).max(604800).optional(),provider_record_reference:opt(1200),purpose:z.string().trim().min(3).max(4000)}),
 z.object({action:z.literal("REVIEW_DNS"),change_id:uuid,status:z.enum(["APPROVED","REJECTED"]),note:opt(2000)}),
 z.object({action:z.literal("MARK_DNS_APPLIED"),change_id:uuid,evidence_reference:z.string().trim().min(3).max(1200)}),
 z.object({action:z.literal("VERIFY_DNS"),change_id:uuid,observed_value_sha256:sha,evidence_reference:z.string().trim().min(3).max(1200)}),
 z.object({action:z.literal("RECORD_CERT"),domain_id:uuid,service_id:uuid.optional(),hostname:z.string().trim().min(1).max(255),issuer:z.string().trim().min(2).max(300),fingerprint:z.string().trim().min(64).max(128),provider_reference:opt(1200),issued_at:z.string().datetime({offset:true}).optional(),expires_at:z.string().datetime({offset:true}),auto_managed:z.boolean()}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeDomainControlError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Domain-control operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getDomainControlOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin domain-control mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid domain-control operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_DOMAIN")return NextResponse.json(await createDomain({domain:i.domain,registrar:i.registrar,dnsProvider:i.dns_provider,registeredOn:i.registered_on,expiresOn:i.expires_on,autoRenew:i.auto_renew,ownerUserId:i.owner_user_id,renewalReference:i.renewal_reference}),{status:201});
  if(i.action==="UPDATE_DOMAIN")return NextResponse.json(await updateDomain({domainId:i.domain_id,registrar:i.registrar,dnsProvider:i.dns_provider,expiresOn:i.expires_on,autoRenew:i.auto_renew,ownerUserId:i.owner_user_id,renewalReference:i.renewal_reference,status:i.status}));
  if(i.action==="PROPOSE_DNS")return NextResponse.json(await proposeDnsChange({domainId:i.domain_id,recordName:i.record_name,recordType:i.record_type,expectedSha256:i.expected_value_sha256,ttl:i.ttl_seconds,providerReference:i.provider_record_reference,purpose:i.purpose}),{status:201});
  if(i.action==="REVIEW_DNS")return NextResponse.json(await reviewDnsChange({changeId:i.change_id,status:i.status,note:i.note}));
  if(i.action==="MARK_DNS_APPLIED")return NextResponse.json(await markDnsApplied({changeId:i.change_id,evidence:i.evidence_reference}));
  if(i.action==="VERIFY_DNS")return NextResponse.json(await verifyDnsChange({changeId:i.change_id,observedSha256:i.observed_value_sha256,evidence:i.evidence_reference}));
  return NextResponse.json(await recordTlsCertificate({domainId:i.domain_id,serviceId:i.service_id,hostname:i.hostname,issuer:i.issuer,fingerprint:i.fingerprint,providerReference:i.provider_reference,issuedAt:i.issued_at,expiresAt:i.expires_at,autoManaged:i.auto_managed}),{status:201});
 }catch(error){return failure(error)}
}
