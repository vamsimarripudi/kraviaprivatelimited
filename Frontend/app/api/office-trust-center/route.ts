import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  closeCustomerTrust,
  createCustomerTrustRequest,
  createVendorAssessment,
  getTrustCenter,
  OfficeTrustError,
  prepareCustomerTrust,
  reviewCustomerTrust,
  sendCustomerTrust,
  transitionVendorAssessment,
} from "@/lib/office/trust-center-server";

const uuid=z.string().uuid();
const opt=(max:number)=>z.string().trim().max(max).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_VENDOR_ASSESSMENT"),vendor_id:z.string().trim().min(1).max(120),assessment_type:z.enum(["SECURITY","PRIVACY","LEGAL","FINANCIAL","BUSINESS_CONTINUITY","AI","OTHER"]),scope_summary:z.string().trim().min(3).max(10000),risk_level:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),evidence_reference:opt(1200),remediation_summary:opt(8000),owner_user_id:uuid,expires_on:z.string().date().optional()}),
 z.object({action:z.literal("TRANSITION_VENDOR_ASSESSMENT"),assessment_id:uuid,status:z.enum(["SUBMITTED","APPROVED","REJECTED","EXPIRED","CANCELLED"]),evidence_reference:opt(1200),remediation_summary:opt(8000),expires_on:z.string().date().optional(),note:opt(2000)}),
 z.object({action:z.literal("CREATE_CUSTOMER_TRUST"),customer_id:z.string().trim().min(1).max(120),request_type:z.enum(["SECURITY_QUESTIONNAIRE","DPA","COMPLIANCE_EVIDENCE","PEN_TEST","SLA","SUBPROCESSOR","ARCHITECTURE","PRIVACY","OTHER"]),title:z.string().trim().min(3).max(220),request_summary:z.string().trim().min(3).max(12000),owner_user_id:uuid,due_at:z.string().datetime({offset:true}).optional()}),
 z.object({action:z.literal("PREPARE_CUSTOMER_TRUST"),trust_id:uuid,status:z.enum(["IN_PROGRESS","AWAITING_REVIEW","CANCELLED"]),response_reference:opt(1200),evidence_reference:opt(1200),note:opt(2000)}),
 z.object({action:z.literal("REVIEW_CUSTOMER_TRUST"),trust_id:uuid,status:z.enum(["READY","REJECTED"]),note:opt(2000)}),
 z.object({action:z.literal("SEND_CUSTOMER_TRUST"),trust_id:uuid,sent_reference:z.string().trim().min(3).max(1200)}),
 z.object({action:z.literal("CLOSE_CUSTOMER_TRUST"),trust_id:uuid,note:opt(2000)}),
]);

function failure(error:unknown){
 const status=error instanceof OfficeTrustError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Trust Center operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getTrustCenter(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin Trust Center mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid Trust Center operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_VENDOR_ASSESSMENT")return NextResponse.json(await createVendorAssessment({vendorId:i.vendor_id,type:i.assessment_type,scope:i.scope_summary,risk:i.risk_level,evidence:i.evidence_reference,remediation:i.remediation_summary,ownerUserId:i.owner_user_id,expiresOn:i.expires_on}),{status:201});
  if(i.action==="TRANSITION_VENDOR_ASSESSMENT")return NextResponse.json(await transitionVendorAssessment({assessmentId:i.assessment_id,status:i.status,evidence:i.evidence_reference,remediation:i.remediation_summary,expiresOn:i.expires_on,note:i.note}));
  if(i.action==="CREATE_CUSTOMER_TRUST")return NextResponse.json(await createCustomerTrustRequest({customerId:i.customer_id,type:i.request_type,title:i.title,summary:i.request_summary,ownerUserId:i.owner_user_id,dueAt:i.due_at}),{status:201});
  if(i.action==="PREPARE_CUSTOMER_TRUST")return NextResponse.json(await prepareCustomerTrust({trustId:i.trust_id,status:i.status,response:i.response_reference,evidence:i.evidence_reference,note:i.note}));
  if(i.action==="REVIEW_CUSTOMER_TRUST")return NextResponse.json(await reviewCustomerTrust({trustId:i.trust_id,status:i.status,note:i.note}));
  if(i.action==="SEND_CUSTOMER_TRUST")return NextResponse.json(await sendCustomerTrust({trustId:i.trust_id,sentReference:i.sent_reference}));
  return NextResponse.json(await closeCustomerTrust({trustId:i.trust_id,note:i.note}));
 }catch(error){return failure(error)}
}
