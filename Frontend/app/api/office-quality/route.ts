import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  closeNonconformance,
  createCapa,
  createQualityProcess,
  createQualityProcessVersion,
  getQualityOverview,
  manageNonconformance,
  OfficeQualityError,
  publishQualityProcess,
  reportNonconformance,
  transitionCapa,
} from "@/lib/office/quality-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const textList=z.array(z.string().trim().min(1).max(1000)).max(100);
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_PROCESS"),title:z.string().trim().min(3).max(220),department:z.string().trim().min(2).max(120),owner_user_id:uuid,purpose:z.string().trim().min(3).max(12000),scope:z.string().trim().min(3).max(12000),procedure:z.string().trim().min(10).max(30000),controls:textList,evidence_requirements:textList,standard_reference:opt(1200),next_review_on:z.string().date().optional()}),
 z.object({action:z.literal("NEW_PROCESS_VERSION"),process_id:uuid,purpose:z.string().trim().min(3).max(12000),scope:z.string().trim().min(3).max(12000),procedure:z.string().trim().min(10).max(30000),controls:textList,evidence_requirements:textList,standard_reference:opt(1200),change_summary:opt(3000)}),
 z.object({action:z.literal("PUBLISH_PROCESS"),version_id:uuid}),
 z.object({action:z.literal("REPORT_NC"),process_id:uuid.optional(),source:z.enum(["PROCESS","AUDIT","CUSTOMER","INCIDENT","SECURITY","SUPPLIER","PRODUCT","OTHER"]),severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),title:z.string().trim().min(3).max(220),description:z.string().trim().min(3).max(20000),evidence:opt(1200)}),
 z.object({action:z.literal("MANAGE_NC"),nonconformance_id:uuid,status:z.enum(["TRIAGED","CONTAINED","CAPA_REQUIRED","AWAITING_CLOSE_REVIEW","CANCELLED"]),owner_user_id:uuid.optional(),containment:opt(8000),note:opt(3000)}),
 z.object({action:z.literal("CLOSE_NC"),nonconformance_id:uuid,evidence:z.string().trim().min(3).max(1200),note:opt(3000)}),
 z.object({action:z.literal("CREATE_CAPA"),nonconformance_id:uuid,action_type:z.enum(["CORRECTIVE","PREVENTIVE","BOTH"]),owner_user_id:uuid,root_cause:z.string().trim().min(3).max(12000),action_plan:z.string().trim().min(3).max(12000),due_on:z.string().date().optional()}),
 z.object({action:z.literal("TRANSITION_CAPA"),capa_id:uuid,status:z.enum(["IN_PROGRESS","AWAITING_VERIFICATION","VERIFIED_EFFECTIVE","VERIFIED_INEFFECTIVE","CLOSED","CANCELLED"]),completion_evidence:opt(1200),effectiveness_evidence:opt(1200),note:opt(3000)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeQualityError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Quality operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getQualityOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin quality mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid quality operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_PROCESS")return NextResponse.json(await createQualityProcess({title:i.title,department:i.department,ownerUserId:i.owner_user_id,purpose:i.purpose,scope:i.scope,procedure:i.procedure,controls:i.controls,evidenceRequirements:i.evidence_requirements,standardReference:i.standard_reference,nextReviewOn:i.next_review_on}),{status:201});
  if(i.action==="NEW_PROCESS_VERSION")return NextResponse.json(await createQualityProcessVersion({processId:i.process_id,purpose:i.purpose,scope:i.scope,procedure:i.procedure,controls:i.controls,evidenceRequirements:i.evidence_requirements,standardReference:i.standard_reference,changeSummary:i.change_summary}),{status:201});
  if(i.action==="PUBLISH_PROCESS")return NextResponse.json(await publishQualityProcess({versionId:i.version_id}));
  if(i.action==="REPORT_NC")return NextResponse.json(await reportNonconformance({processId:i.process_id,source:i.source,severity:i.severity,title:i.title,description:i.description,evidence:i.evidence}),{status:201});
  if(i.action==="MANAGE_NC")return NextResponse.json(await manageNonconformance({nonconformanceId:i.nonconformance_id,status:i.status,ownerUserId:i.owner_user_id,containment:i.containment,note:i.note}));
  if(i.action==="CLOSE_NC")return NextResponse.json(await closeNonconformance({nonconformanceId:i.nonconformance_id,evidence:i.evidence,note:i.note}));
  if(i.action==="CREATE_CAPA")return NextResponse.json(await createCapa({nonconformanceId:i.nonconformance_id,type:i.action_type,ownerUserId:i.owner_user_id,rootCause:i.root_cause,actionPlan:i.action_plan,dueOn:i.due_on}),{status:201});
  return NextResponse.json(await transitionCapa({capaId:i.capa_id,status:i.status,completionEvidence:i.completion_evidence,effectivenessEvidence:i.effectiveness_evidence,note:i.note}));
 }catch(error){return failure(error)}
}
