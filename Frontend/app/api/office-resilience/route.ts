import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createContinuityPlan,
  createInsuranceClaim,
  createInsurancePolicy,
  createResilienceTest,
  getResilienceOverview,
  OfficeResilienceError,
  reportEmergencyIncident,
  transitionContinuityPlan,
  transitionEmergencyIncident,
  transitionInsuranceClaim,
  transitionResilienceTest,
} from "@/lib/office/resilience-server";

const uuid=z.string().uuid();
const opt=(max:number)=>z.string().trim().max(max).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_PLAN"),title:z.string().trim().min(3).max(220),plan_type:z.enum(["BUSINESS_CONTINUITY","DISASTER_RECOVERY","EMERGENCY_RESPONSE","DEPENDENCY_RECOVERY","OTHER"]),criticality:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),owner_user_id:uuid,scope:z.string().trim().min(3).max(10000),recovery_order:z.string().trim().min(3).max(10000),fallback_procedure:z.string().trim().min(3).max(10000),communication_plan:opt(10000),rto_minutes:z.number().int().min(0).max(525600).optional(),rpo_minutes:z.number().int().min(0).max(525600).optional(),next_test_on:z.string().date().optional()}),
 z.object({action:z.literal("TRANSITION_PLAN"),plan_id:uuid,status:z.enum(["SUBMITTED","APPROVED","ACTIVE","RETIRED","REJECTED"]),note:opt(2000)}),
 z.object({action:z.literal("CREATE_TEST"),plan_id:uuid,test_type:z.enum(["TABLETOP","RESTORE","FAILOVER","COMMUNICATION","EVACUATION","BACKUP_RECOVERY","OTHER"]),owner_user_id:uuid,scheduled_on:z.string().date()}),
 z.object({action:z.literal("TRANSITION_TEST"),test_id:uuid,status:z.enum(["IN_PROGRESS","AWAITING_REVIEW","VERIFIED_PASS","VERIFIED_FAIL","CANCELLED"]),summary:opt(8000),evidence:opt(1200)}),
 z.object({action:z.literal("REPORT_INCIDENT"),site_id:uuid.optional(),category:z.enum(["FIRE","MEDICAL","SECURITY","POWER","NETWORK","WEATHER","SAFETY","FACILITY","OTHER"]),severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),title:z.string().trim().min(3).max(220),description:z.string().trim().min(3).max(10000)}),
 z.object({action:z.literal("TRANSITION_INCIDENT"),incident_id:uuid,status:z.enum(["ACTIVE","CONTAINED","RECOVERING","RESOLVED","CLOSED","CANCELLED"]),commander_user_id:uuid.optional(),containment:opt(8000),recovery:opt(8000),evidence:opt(1200)}),
 z.object({action:z.literal("CREATE_POLICY"),insurance_type:z.enum(["EMPLOYEE","CYBER","DIRECTORS_OFFICERS","EQUIPMENT","PROPERTY","LIABILITY","TRAVEL","OTHER"]),provider:z.string().trim().min(2).max(220),policy_reference:z.string().trim().min(2).max(500),coverage:z.string().trim().min(3).max(10000),premium_paise:z.number().int().min(0).optional(),currency:z.string().trim().length(3),effective_on:z.string().date(),expires_on:z.string().date(),owner_user_id:uuid,document_reference:z.string().trim().min(3).max(1200)}),
 z.object({action:z.literal("CREATE_CLAIM"),policy_id:uuid,incident_id:uuid.optional(),owner_user_id:uuid,amount_paise:z.number().int().min(0).optional(),currency:z.string().trim().length(3),description:z.string().trim().min(3).max(10000),evidence:z.string().trim().min(3).max(1200)}),
 z.object({action:z.literal("TRANSITION_CLAIM"),claim_id:uuid,status:z.enum(["UNDER_REVIEW","APPROVED","REJECTED","PAID","CLOSED"]),note:opt(3000),insurer_reference:opt(1200),payment_reference:opt(1200)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeResilienceError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Resilience operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getResilienceOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin resilience mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid resilience operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_PLAN")return NextResponse.json(await createContinuityPlan({title:i.title,type:i.plan_type,criticality:i.criticality,ownerUserId:i.owner_user_id,scope:i.scope,recoveryOrder:i.recovery_order,fallback:i.fallback_procedure,communication:i.communication_plan,rtoMinutes:i.rto_minutes,rpoMinutes:i.rpo_minutes,nextTestOn:i.next_test_on}),{status:201});
  if(i.action==="TRANSITION_PLAN")return NextResponse.json(await transitionContinuityPlan({planId:i.plan_id,status:i.status,note:i.note}));
  if(i.action==="CREATE_TEST")return NextResponse.json(await createResilienceTest({planId:i.plan_id,type:i.test_type,ownerUserId:i.owner_user_id,scheduledOn:i.scheduled_on}),{status:201});
  if(i.action==="TRANSITION_TEST")return NextResponse.json(await transitionResilienceTest({testId:i.test_id,status:i.status,summary:i.summary,evidence:i.evidence}));
  if(i.action==="REPORT_INCIDENT")return NextResponse.json(await reportEmergencyIncident({siteId:i.site_id,category:i.category,severity:i.severity,title:i.title,description:i.description}),{status:201});
  if(i.action==="TRANSITION_INCIDENT")return NextResponse.json(await transitionEmergencyIncident({incidentId:i.incident_id,status:i.status,commanderUserId:i.commander_user_id,containment:i.containment,recovery:i.recovery,evidence:i.evidence}));
  if(i.action==="CREATE_POLICY")return NextResponse.json(await createInsurancePolicy({type:i.insurance_type,provider:i.provider,policyReference:i.policy_reference,coverage:i.coverage,premiumPaise:i.premium_paise,currency:i.currency,effectiveOn:i.effective_on,expiresOn:i.expires_on,ownerUserId:i.owner_user_id,documentReference:i.document_reference}),{status:201});
  if(i.action==="CREATE_CLAIM")return NextResponse.json(await createInsuranceClaim({policyId:i.policy_id,incidentId:i.incident_id,ownerUserId:i.owner_user_id,amountPaise:i.amount_paise,currency:i.currency,description:i.description,evidence:i.evidence}),{status:201});
  return NextResponse.json(await transitionInsuranceClaim({claimId:i.claim_id,status:i.status,note:i.note,insurerReference:i.insurer_reference,paymentReference:i.payment_reference}));
 }catch(error){return failure(error)}
}
