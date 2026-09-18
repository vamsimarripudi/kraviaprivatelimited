import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
 acknowledgePolicy,createAnnouncement,createKnowledge,createPolicy,getKnowledgeHub,newKnowledgeVersion,newPolicyVersion,
 OfficeKnowledgeError,publishKnowledge,publishPolicy,receiptAnnouncement,
} from "@/lib/office/knowledge-server";

const uuid=z.string().uuid(); const opt=(n:number)=>z.string().trim().max(n).optional();
const audience=z.object({audience_type:z.enum(["COMPANY","DEPARTMENT","ROLE"]),audience_key:opt(120)});
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_POLICY"),title:z.string().trim().min(3).max(220),category:z.enum(["GOVERNANCE","HR","SECURITY","PRIVACY","FINANCE","PROCUREMENT","LEGAL","ENGINEERING","AI","REMOTE_WORK","ATTENDANCE","LEAVE","ETHICS","OTHER"]),acknowledgement_required:z.boolean(),owner_user_id:uuid,content:z.string().trim().min(10).max(100000),effective_on:z.string().date().optional(),change_summary:opt(3000)}).merge(audience),
 z.object({action:z.literal("NEW_POLICY_VERSION"),policy_id:uuid,content:z.string().trim().min(10).max(100000),effective_on:z.string().date().optional(),change_summary:opt(3000)}),
 z.object({action:z.literal("PUBLISH_POLICY"),version_id:uuid}),
 z.object({action:z.literal("ACK_POLICY"),version_id:uuid}),
 z.object({action:z.literal("CREATE_ANNOUNCEMENT"),title:z.string().trim().min(3).max(220),body:z.string().trim().min(3).max(30000),announcement_type:z.enum(["GENERAL","POLICY","SECURITY_ALERT","HOLIDAY","OFFICE","PRODUCT","EMERGENCY","OTHER"]),requires_ack:z.boolean(),priority:z.enum(["LOW","NORMAL","HIGH","CRITICAL"]),expires_at:z.string().datetime({offset:true}).optional()}).merge(audience),
 z.object({action:z.literal("ANNOUNCEMENT_RECEIPT"),announcement_id:uuid,acknowledged:z.boolean()}),
 z.object({action:z.literal("CREATE_KNOWLEDGE"),title:z.string().trim().min(3).max(220),category:z.enum(["SOP","RUNBOOK","ARCHITECTURE","HANDBOOK","PRODUCT","SECURITY","FINANCE","HR","LEGAL","SUPPORT","OTHER"]),owner_user_id:uuid,content:z.string().trim().min(10).max(100000),change_summary:opt(3000)}).merge(audience),
 z.object({action:z.literal("NEW_KNOWLEDGE_VERSION"),article_id:uuid,content:z.string().trim().min(10).max(100000),change_summary:opt(3000)}),
 z.object({action:z.literal("PUBLISH_KNOWLEDGE"),version_id:uuid}),
]);
function failure(error:unknown){const status=error instanceof OfficeKnowledgeError?error.status:500;return NextResponse.json({detail:error instanceof Error?error.message:"Knowledge Hub operation failed"},{status,headers:{"Cache-Control":"no-store"}})}
export async function GET(){try{return NextResponse.json(await getKnowledgeHub(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin knowledge mutation is not allowed"},{status:403});
 const p=schema.safeParse(await request.json().catch(()=>null)); if(!p.success)return NextResponse.json({detail:"Invalid Knowledge Hub action"},{status:400});
 try{const i=p.data;
  if(i.action==="CREATE_POLICY")return NextResponse.json(await createPolicy({title:i.title,category:i.category,audienceType:i.audience_type,audienceKey:i.audience_key,ack:i.acknowledgement_required,ownerUserId:i.owner_user_id,content:i.content,effectiveOn:i.effective_on,changeSummary:i.change_summary}),{status:201});
  if(i.action==="NEW_POLICY_VERSION")return NextResponse.json(await newPolicyVersion({policyId:i.policy_id,content:i.content,effectiveOn:i.effective_on,summary:i.change_summary}),{status:201});
  if(i.action==="PUBLISH_POLICY")return NextResponse.json(await publishPolicy(i.version_id));
  if(i.action==="ACK_POLICY")return NextResponse.json(await acknowledgePolicy(i.version_id));
  if(i.action==="CREATE_ANNOUNCEMENT")return NextResponse.json(await createAnnouncement({title:i.title,body:i.body,type:i.announcement_type,audienceType:i.audience_type,audienceKey:i.audience_key,requiresAck:i.requires_ack,priority:i.priority,expiresAt:i.expires_at}),{status:201});
  if(i.action==="ANNOUNCEMENT_RECEIPT")return NextResponse.json(await receiptAnnouncement(i.announcement_id,i.acknowledged));
  if(i.action==="CREATE_KNOWLEDGE")return NextResponse.json(await createKnowledge({title:i.title,category:i.category,audienceType:i.audience_type,audienceKey:i.audience_key,ownerUserId:i.owner_user_id,content:i.content,summary:i.change_summary}),{status:201});
  if(i.action==="NEW_KNOWLEDGE_VERSION")return NextResponse.json(await newKnowledgeVersion({articleId:i.article_id,content:i.content,summary:i.change_summary}),{status:201});
  return NextResponse.json(await publishKnowledge(i.version_id));
 }catch(error){return failure(error)}
}
