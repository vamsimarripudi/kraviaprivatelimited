import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { addEthicsNote,assignEthicsInvestigator,getEthicsWorkspace,OfficeEthicsError,reportEthicsCase,transitionEthicsCase } from "@/lib/office/ethics-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("REPORT"),category:z.enum(["CODE_OF_CONDUCT","HARASSMENT","DISCRIMINATION","FRAUD","BRIBERY","CONFLICT_OF_INTEREST","DATA_MISUSE","SECURITY","RETALIATION","SAFETY","OTHER"]),severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),title:z.string().trim().min(3).max(220),report:z.string().trim().min(10).max(30000),evidence:opt(1200)}),
 z.object({action:z.literal("ASSIGN"),case_id:uuid,investigator_user_id:uuid}),
 z.object({action:z.literal("NOTE"),case_id:uuid,visibility:z.enum(["REPORTER","INVESTIGATOR"]),note:z.string().trim().min(1).max(10000),evidence:opt(1200)}),
 z.object({action:z.literal("TRANSITION"),case_id:uuid,status:z.enum(["TRIAGE","INVESTIGATING","ACTION_PENDING","AWAITING_REVIEW","CLOSED","UNSUBSTANTIATED","WITHDRAWN"]),outcome:opt(10000),reporter_outcome:opt(5000)}),
]);
function failure(error:unknown){const status=error instanceof OfficeEthicsError?error.status:500;return NextResponse.json({detail:error instanceof Error?error.message:"Ethics operation failed"},{status,headers:{"Cache-Control":"no-store"}})}
export async function GET(){try{return NextResponse.json(await getEthicsWorkspace(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin ethics mutation is not allowed"},{status:403});
 const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return NextResponse.json({detail:"Invalid ethics operation"},{status:400});
 try{const i=p.data;
  if(i.action==="REPORT")return NextResponse.json(await reportEthicsCase({category:i.category,severity:i.severity,title:i.title,report:i.report,evidence:i.evidence}),{status:201});
  if(i.action==="ASSIGN")return NextResponse.json(await assignEthicsInvestigator({caseId:i.case_id,investigatorUserId:i.investigator_user_id}));
  if(i.action==="NOTE")return NextResponse.json(await addEthicsNote({caseId:i.case_id,visibility:i.visibility,note:i.note,evidence:i.evidence}),{status:201});
  return NextResponse.json(await transitionEthicsCase({caseId:i.case_id,status:i.status,outcome:i.outcome,reporterOutcome:i.reporter_outcome}));
 }catch(error){return failure(error)}
}
