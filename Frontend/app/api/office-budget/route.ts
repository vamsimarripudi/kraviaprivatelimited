import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createBudget,
  createBudgetCommitment,
  createBudgetCycle,
  getBudgetOverview,
  OfficeBudgetError,
  recordBudgetActual,
  releaseBudgetCommitment,
  requestBudgetAdjustment,
  reviewBudgetAdjustment,
  transitionBudget,
  transitionBudgetCycle,
} from "@/lib/office/budget-server";

const uuid=z.string().uuid();
const opt=(max:number)=>z.string().trim().max(max).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_CYCLE"),title:z.string().trim().min(3).max(180),period_start:z.string().date(),period_end:z.string().date()}),
 z.object({action:z.literal("TRANSITION_CYCLE"),cycle_id:uuid,status:z.enum(["SUBMITTED","APPROVED","ACTIVE","CLOSED","REJECTED"]),note:opt(2000)}),
 z.object({action:z.literal("CREATE_BUDGET"),cycle_id:uuid,scope_type:z.enum(["COMPANY","DEPARTMENT","PRODUCT","PROJECT","COST_CENTER"]),scope_key:opt(180),category:z.string().trim().min(2).max(120),currency:z.string().trim().length(3),allocation_minor:z.number().int().min(0)}),
 z.object({action:z.literal("TRANSITION_BUDGET"),budget_id:uuid,status:z.enum(["SUBMITTED","APPROVED","CLOSED","REJECTED"]),note:opt(2000)}),
 z.object({action:z.literal("REQUEST_ADJUSTMENT"),budget_id:uuid,delta_minor:z.number().int().refine(v=>v!==0),reason:z.string().trim().min(3).max(4000),evidence:opt(1200)}),
 z.object({action:z.literal("REVIEW_ADJUSTMENT"),adjustment_id:uuid,status:z.enum(["APPROVED","REJECTED"]),note:opt(2000)}),
 z.object({action:z.literal("COMMIT"),budget_id:uuid,source_type:z.enum(["PROCUREMENT","TRAVEL","HIRING","SOFTWARE","PROJECT","CONTRACT","CARD","OTHER"]),source_reference:z.string().trim().min(2).max(500),description:z.string().trim().min(3).max(4000),amount_minor:z.number().int().positive(),currency:z.string().trim().length(3),approval_reference:z.string().trim().min(2).max(1200)}),
 z.object({action:z.literal("RELEASE_COMMITMENT"),commitment_id:uuid,reason:z.string().trim().min(3).max(2000)}),
 z.object({action:z.literal("RECORD_ACTUAL"),budget_id:uuid,commitment_id:uuid.optional(),source_type:z.string().trim().min(2).max(120),source_reference:z.string().trim().min(2).max(500),description:z.string().trim().min(3).max(4000),amount_minor:z.number().int().positive(),currency:z.string().trim().length(3),evidence:z.string().trim().min(3).max(1200)}),
]);

function failure(error:unknown){
 const status=error instanceof OfficeBudgetError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Budget operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}

export async function GET(){
 try{return NextResponse.json(await getBudgetOverview(),{headers:{"Cache-Control":"no-store"}})}
 catch(error){return failure(error)}
}

export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin budget mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid budget operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_CYCLE")return NextResponse.json(await createBudgetCycle({title:i.title,start:i.period_start,end:i.period_end}),{status:201});
  if(i.action==="TRANSITION_CYCLE")return NextResponse.json(await transitionBudgetCycle({cycleId:i.cycle_id,status:i.status,note:i.note}));
  if(i.action==="CREATE_BUDGET")return NextResponse.json(await createBudget({cycleId:i.cycle_id,scopeType:i.scope_type,scopeKey:i.scope_key,category:i.category,currency:i.currency,allocationMinor:i.allocation_minor}),{status:201});
  if(i.action==="TRANSITION_BUDGET")return NextResponse.json(await transitionBudget({budgetId:i.budget_id,status:i.status,note:i.note}));
  if(i.action==="REQUEST_ADJUSTMENT")return NextResponse.json(await requestBudgetAdjustment({budgetId:i.budget_id,deltaMinor:i.delta_minor,reason:i.reason,evidence:i.evidence}),{status:201});
  if(i.action==="REVIEW_ADJUSTMENT")return NextResponse.json(await reviewBudgetAdjustment({adjustmentId:i.adjustment_id,status:i.status,note:i.note}));
  if(i.action==="COMMIT")return NextResponse.json(await createBudgetCommitment({budgetId:i.budget_id,sourceType:i.source_type,sourceReference:i.source_reference,description:i.description,amountMinor:i.amount_minor,currency:i.currency,approvalReference:i.approval_reference}),{status:201});
  if(i.action==="RELEASE_COMMITMENT")return NextResponse.json(await releaseBudgetCommitment({commitmentId:i.commitment_id,reason:i.reason}));
  return NextResponse.json(await recordBudgetActual({budgetId:i.budget_id,commitmentId:i.commitment_id,sourceType:i.source_type,sourceReference:i.source_reference,description:i.description,amountMinor:i.amount_minor,currency:i.currency,evidence:i.evidence}),{status:201});
 }catch(error){return failure(error)}
}
