import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  assignTraining,
  createPerformanceReview,
  createTraining,
  createWorkforcePlan,
  declareOwnSkill,
  getPeopleDevelopmentOverview,
  OfficePeopleDevelopmentError,
  transitionPerformanceReview,
  transitionTraining,
  transitionWorkforcePlan,
  verifySkill,
} from "@/lib/office/people-development-server";

const uuid=z.string().uuid();
const optionalText=(max:number)=>z.string().trim().max(max).optional();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("DECLARE_SKILL"),skill:z.string().trim().min(2).max(120),level:z.enum(["AWARENESS","FOUNDATIONAL","INTERMEDIATE","ADVANCED","EXPERT"]),evidence:optionalText(1200)}),
  z.object({action:z.literal("VERIFY_SKILL"),skill_id:uuid,status:z.enum(["VERIFIED","EXPIRED"]),evidence:optionalText(1200)}),
  z.object({action:z.literal("CREATE_TRAINING"),title:z.string().trim().min(3).max(180),category:z.enum(["SECURITY","PRIVACY","COMPLIANCE","TECHNICAL","PRODUCT","LEADERSHIP","SAFETY","HR","OTHER"]),description:z.string().trim().min(3).max(8000),validity_months:z.number().int().min(1).max(120).optional(),evidence_required:z.boolean()}),
  z.object({action:z.literal("ASSIGN_TRAINING"),training_id:uuid,user_id:uuid,due_on:z.string().date().optional(),note:optionalText(2000)}),
  z.object({action:z.literal("TRANSITION_TRAINING"),assignment_id:uuid,status:z.enum(["IN_PROGRESS","COMPLETED","WAIVED","EXPIRED"]),evidence:optionalText(1200),note:optionalText(2000)}),
  z.object({action:z.literal("CREATE_PERFORMANCE"),user_id:uuid,reviewer_user_id:uuid,period_start:z.string().date(),period_end:z.string().date(),goals:z.array(z.string().trim().min(1).max(500)).max(30)}),
  z.object({action:z.literal("TRANSITION_PERFORMANCE"),review_id:uuid,status:z.enum(["EMPLOYEE_INPUT","MANAGER_REVIEW","FINAL"]),employee_summary:optionalText(8000),reviewer_summary:optionalText(8000),outcome:z.enum(["EXCEEDS_EXPECTATIONS","MEETS_EXPECTATIONS","DEVELOPMENT_REQUIRED","NOT_RATED"]).optional(),development_plan:optionalText(8000)}),
  z.object({action:z.literal("CREATE_WORKFORCE_PLAN"),department:z.string().trim().min(2).max(120),period_start:z.string().date(),period_end:z.string().date(),current_headcount:z.number().int().min(0).max(100000),target_headcount:z.number().int().min(0).max(100000),rationale:z.string().trim().min(3).max(8000),budget_reference:optionalText(1200)}),
  z.object({action:z.literal("TRANSITION_WORKFORCE_PLAN"),plan_id:uuid,status:z.enum(["SUBMITTED","APPROVED","REJECTED","CLOSED"]),approved_headcount:z.number().int().min(0).max(100000).optional(),note:optionalText(2000)}),
]);

function failure(error:unknown){
  const status=error instanceof OfficePeopleDevelopmentError?error.status:500;
  return NextResponse.json({detail:error instanceof Error?error.message:"People Development request failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){
  try{return NextResponse.json(await getPeopleDevelopmentOverview(),{headers:{"Cache-Control":"no-store"}})}
  catch(error){return failure(error)}
}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin People Development mutation is not allowed"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid People Development request"},{status:400});
  try{
    const input=parsed.data;
    if(input.action==="DECLARE_SKILL")return NextResponse.json(await declareOwnSkill({skill:input.skill,level:input.level,evidence:input.evidence}),{status:201});
    if(input.action==="VERIFY_SKILL")return NextResponse.json(await verifySkill({skillId:input.skill_id,status:input.status,evidence:input.evidence}));
    if(input.action==="CREATE_TRAINING")return NextResponse.json(await createTraining({title:input.title,category:input.category,description:input.description,validityMonths:input.validity_months,evidenceRequired:input.evidence_required}),{status:201});
    if(input.action==="ASSIGN_TRAINING")return NextResponse.json(await assignTraining({trainingId:input.training_id,userId:input.user_id,dueOn:input.due_on,note:input.note}),{status:201});
    if(input.action==="TRANSITION_TRAINING")return NextResponse.json(await transitionTraining({assignmentId:input.assignment_id,status:input.status,evidence:input.evidence,note:input.note}));
    if(input.action==="CREATE_PERFORMANCE")return NextResponse.json(await createPerformanceReview({userId:input.user_id,reviewerUserId:input.reviewer_user_id,periodStart:input.period_start,periodEnd:input.period_end,goals:input.goals}),{status:201});
    if(input.action==="TRANSITION_PERFORMANCE")return NextResponse.json(await transitionPerformanceReview({reviewId:input.review_id,status:input.status,employeeSummary:input.employee_summary,reviewerSummary:input.reviewer_summary,outcome:input.outcome,developmentPlan:input.development_plan}));
    if(input.action==="CREATE_WORKFORCE_PLAN")return NextResponse.json(await createWorkforcePlan({department:input.department,periodStart:input.period_start,periodEnd:input.period_end,currentHeadcount:input.current_headcount,targetHeadcount:input.target_headcount,rationale:input.rationale,budgetReference:input.budget_reference}),{status:201});
    return NextResponse.json(await transitionWorkforcePlan({planId:input.plan_id,status:input.status,approvedHeadcount:input.approved_headcount,note:input.note}));
  }catch(error){return failure(error)}
}
