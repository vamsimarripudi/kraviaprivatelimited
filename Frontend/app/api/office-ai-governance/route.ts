import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createAiTool,
  getAiGovernanceOverview,
  OfficeAiGovernanceError,
  recordAiUsage,
  requestAiUse,
  reviewAiUse,
  transitionAiTool,
} from "@/lib/office/ai-governance-server";

const uuid=z.string().uuid();
const dataClass=z.enum(["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED","BOARD","FINANCE","HR","LEGAL","SECURITY","CUSTOMER_CONFIDENTIAL"]);
const opt=(max:number)=>z.string().trim().max(max).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_TOOL"),provider:z.string().trim().min(2).max(180),tool:z.string().trim().min(2).max(180),purpose:z.string().trim().min(3).max(8000),external:z.boolean(),allowed:z.array(dataClass).min(1).max(20),prohibited:z.array(dataClass).max(20),retention:z.string().trim().min(3).max(4000),training_policy:z.string().trim().min(3).max(4000),data_residency:opt(1000),privacy_security_reference:opt(1200),human_review_required:z.boolean(),owner_user_id:uuid,expires_on:z.string().date().optional()}),
 z.object({action:z.literal("TRANSITION_TOOL"),tool_id:uuid,status:z.enum(["SUBMITTED","APPROVED","REJECTED","RETIRED"]),note:opt(2000)}),
 z.object({action:z.literal("REQUEST_USE"),tool_id:uuid,title:z.string().trim().min(3).max(220),purpose:z.string().trim().min(3).max(8000),data_classes:z.array(dataClass).max(20),action_mode:z.enum(["QUERY","ANALYZE","DRAFT","RECOMMENDATION","ACTION_PROPOSAL"]),human_review_required:z.boolean()}),
 z.object({action:z.literal("REVIEW_USE"),use_case_id:uuid,status:z.enum(["APPROVED","REJECTED"]),expires_at:z.string().datetime({offset:true}).optional(),note:opt(2000)}),
 z.object({action:z.literal("RECORD_USAGE"),use_case_id:uuid,action_kind:z.enum(["QUERY","ANALYZE","DRAFT","RECOMMENDATION","ACTION_PROPOSAL"]),data_classes:z.array(dataClass).max(20),content_sha256:z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),provider_reference:opt(1200),result_reference:opt(1200),human_review_reference:opt(1200)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeAiGovernanceError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"AI governance operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getAiGovernanceOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin AI governance mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid AI governance operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_TOOL")return NextResponse.json(await createAiTool({provider:i.provider,tool:i.tool,purpose:i.purpose,external:i.external,allowed:i.allowed,prohibited:i.prohibited,retention:i.retention,trainingPolicy:i.training_policy,residency:i.data_residency,reference:i.privacy_security_reference,humanReview:i.human_review_required,ownerUserId:i.owner_user_id,expiresOn:i.expires_on}),{status:201});
  if(i.action==="TRANSITION_TOOL")return NextResponse.json(await transitionAiTool({toolId:i.tool_id,status:i.status,note:i.note}));
  if(i.action==="REQUEST_USE")return NextResponse.json(await requestAiUse({toolId:i.tool_id,title:i.title,purpose:i.purpose,classes:i.data_classes,mode:i.action_mode,humanReview:i.human_review_required}),{status:201});
  if(i.action==="REVIEW_USE")return NextResponse.json(await reviewAiUse({useCaseId:i.use_case_id,status:i.status,expiresAt:i.expires_at,note:i.note}));
  return NextResponse.json(await recordAiUsage({useCaseId:i.use_case_id,actionKind:i.action_kind,classes:i.data_classes,contentSha256:i.content_sha256,providerReference:i.provider_reference,resultReference:i.result_reference,humanReviewReference:i.human_review_reference}),{status:201});
 }catch(error){return failure(error)}
}
