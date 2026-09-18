import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createStrategyCycle,
  createStrategyKeyResult,
  createStrategyObjective,
  getStrategyOverview,
  OfficeStrategyError,
  reportStrategyProgress,
  transitionStrategyCycle,
  transitionStrategyObjective,
} from "@/lib/office/strategy-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_CYCLE"),title:z.string().trim().min(3).max(220),scope_type:z.enum(["COMPANY","DEPARTMENT"]),scope_key:opt(120),period_start:z.string().date(),period_end:z.string().date(),owner_user_id:uuid}),
 z.object({action:z.literal("TRANSITION_CYCLE"),cycle_id:uuid,status:z.enum(["SUBMITTED","APPROVED","ACTIVE","CLOSED","REJECTED","CANCELLED"]),evidence:opt(1200),note:opt(3000)}),
 z.object({action:z.literal("CREATE_OBJECTIVE"),cycle_id:uuid,parent_objective_id:uuid.optional(),title:z.string().trim().min(3).max(220),description:z.string().trim().min(3).max(12000),owner_user_id:uuid,priority:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"])}),
 z.object({action:z.literal("TRANSITION_OBJECTIVE"),objective_id:uuid,status:z.enum(["ACTIVE","COMPLETED","CANCELLED"]),evidence:opt(1200),note:opt(3000)}),
 z.object({action:z.literal("CREATE_KEY_RESULT"),objective_id:uuid,title:z.string().trim().min(3).max(220),owner_user_id:uuid,measurement_kind:z.enum(["PERCENT","NUMBER","CURRENCY","BOOLEAN","MILESTONE"]),unit:opt(120),start_value:z.number().optional(),target_value:z.number().optional(),currency:z.string().trim().length(3).optional(),due_on:z.string().date().optional()}),
 z.object({action:z.literal("REPORT_PROGRESS"),key_result_id:uuid,current_value:z.number().optional(),status:z.enum(["NOT_STARTED","ON_TRACK","AT_RISK","OFF_TRACK","ACHIEVED","CANCELLED"]),note:opt(4000),evidence:opt(1200)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeStrategyError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Strategy operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getStrategyOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin strategy mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid strategy operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_CYCLE")return NextResponse.json(await createStrategyCycle({title:i.title,scopeType:i.scope_type,scopeKey:i.scope_key,periodStart:i.period_start,periodEnd:i.period_end,ownerUserId:i.owner_user_id}),{status:201});
  if(i.action==="TRANSITION_CYCLE")return NextResponse.json(await transitionStrategyCycle({cycleId:i.cycle_id,status:i.status,evidence:i.evidence,note:i.note}));
  if(i.action==="CREATE_OBJECTIVE")return NextResponse.json(await createStrategyObjective({cycleId:i.cycle_id,parentObjectiveId:i.parent_objective_id,title:i.title,description:i.description,ownerUserId:i.owner_user_id,priority:i.priority}),{status:201});
  if(i.action==="TRANSITION_OBJECTIVE")return NextResponse.json(await transitionStrategyObjective({objectiveId:i.objective_id,status:i.status,evidence:i.evidence,note:i.note}));
  if(i.action==="CREATE_KEY_RESULT")return NextResponse.json(await createStrategyKeyResult({objectiveId:i.objective_id,title:i.title,ownerUserId:i.owner_user_id,kind:i.measurement_kind,unit:i.unit,startValue:i.start_value,targetValue:i.target_value,currency:i.currency,dueOn:i.due_on}),{status:201});
  return NextResponse.json(await reportStrategyProgress({keyResultId:i.key_result_id,value:i.current_value,status:i.status,note:i.note,evidence:i.evidence}));
 }catch(error){return failure(error)}
}
