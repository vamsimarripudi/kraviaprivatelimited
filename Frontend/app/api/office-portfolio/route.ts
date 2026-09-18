import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  assignPortfolioMember,
  createPortfolioDependency,
  createPortfolioMilestone,
  createPortfolioProject,
  createPortfolioWorkstream,
  deactivatePortfolioDependency,
  deactivatePortfolioMember,
  getPortfolioOverview,
  OfficePortfolioError,
  transitionPortfolioMilestone,
  transitionPortfolioProject,
  transitionPortfolioWorkstream,
  updatePortfolioHealth,
} from "@/lib/office/portfolio-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_PROJECT"),program:opt(220),title:z.string().trim().min(3).max(220),description:z.string().trim().min(3).max(12000),department:z.string().trim().min(2).max(120),product_id:z.string().trim().min(1).max(120).optional(),owner_user_id:uuid,sponsor_user_id:uuid.optional(),priority:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),starts_on:z.string().date().optional(),target_end_on:z.string().date().optional(),budget_reference:opt(1200)}),
 z.object({action:z.literal("TRANSITION_PROJECT"),project_id:uuid,status:z.enum(["SUBMITTED","APPROVED","ACTIVE","PAUSED","REJECTED","COMPLETED","CANCELLED"]),evidence:opt(1200),note:opt(3000)}),
 z.object({action:z.literal("UPDATE_HEALTH"),project_id:uuid,health:z.enum(["UNKNOWN","ON_TRACK","AT_RISK","OFF_TRACK"]),note:opt(3000)}),
 z.object({action:z.literal("CREATE_WORKSTREAM"),project_id:uuid,title:z.string().trim().min(2).max(180),description:opt(8000),owner_user_id:uuid,starts_on:z.string().date().optional(),target_end_on:z.string().date().optional()}),
 z.object({action:z.literal("TRANSITION_WORKSTREAM"),workstream_id:uuid,status:z.enum(["ACTIVE","PAUSED","DONE","CANCELLED"]),note:opt(2000)}),
 z.object({action:z.literal("CREATE_MILESTONE"),project_id:uuid,workstream_id:uuid.optional(),title:z.string().trim().min(2).max(220),description:opt(8000),owner_user_id:uuid,due_on:z.string().date().optional(),deliverable_reference:opt(1200)}),
 z.object({action:z.literal("CREATE_DEPENDENCY"),project_id:uuid,predecessor_id:uuid,successor_id:uuid,note:opt(2000)}),
 z.object({action:z.literal("DEACTIVATE_DEPENDENCY"),dependency_id:uuid,reason:z.string().trim().min(3).max(2000)}),
 z.object({action:z.literal("TRANSITION_MILESTONE"),milestone_id:uuid,status:z.enum(["PLANNED","IN_PROGRESS","BLOCKED","DONE","CANCELLED"]),blocked_reason:opt(3000),evidence:opt(1200),note:opt(2000)}),
 z.object({action:z.literal("ASSIGN_MEMBER"),project_id:uuid,user_id:uuid,project_role:z.string().trim().min(2).max(120),workstream_id:uuid.optional()}),
 z.object({action:z.literal("DEACTIVATE_MEMBER"),membership_id:uuid,reason:z.string().trim().min(3).max(2000)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficePortfolioError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Portfolio operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getPortfolioOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin portfolio mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid portfolio operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_PROJECT")return NextResponse.json(await createPortfolioProject({program:i.program,title:i.title,description:i.description,department:i.department,productId:i.product_id,ownerUserId:i.owner_user_id,sponsorUserId:i.sponsor_user_id,priority:i.priority,startsOn:i.starts_on,targetEndOn:i.target_end_on,budgetReference:i.budget_reference}),{status:201});
  if(i.action==="TRANSITION_PROJECT")return NextResponse.json(await transitionPortfolioProject({projectId:i.project_id,status:i.status,evidence:i.evidence,note:i.note}));
  if(i.action==="UPDATE_HEALTH")return NextResponse.json(await updatePortfolioHealth({projectId:i.project_id,health:i.health,note:i.note}));
  if(i.action==="CREATE_WORKSTREAM")return NextResponse.json(await createPortfolioWorkstream({projectId:i.project_id,title:i.title,description:i.description,ownerUserId:i.owner_user_id,startsOn:i.starts_on,targetEndOn:i.target_end_on}),{status:201});
  if(i.action==="TRANSITION_WORKSTREAM")return NextResponse.json(await transitionPortfolioWorkstream({workstreamId:i.workstream_id,status:i.status,note:i.note}));
  if(i.action==="CREATE_MILESTONE")return NextResponse.json(await createPortfolioMilestone({projectId:i.project_id,workstreamId:i.workstream_id,title:i.title,description:i.description,ownerUserId:i.owner_user_id,dueOn:i.due_on,deliverableReference:i.deliverable_reference}),{status:201});
  if(i.action==="CREATE_DEPENDENCY")return NextResponse.json(await createPortfolioDependency({projectId:i.project_id,predecessorId:i.predecessor_id,successorId:i.successor_id,note:i.note}),{status:201});
  if(i.action==="DEACTIVATE_DEPENDENCY")return NextResponse.json(await deactivatePortfolioDependency({dependencyId:i.dependency_id,reason:i.reason}));
  if(i.action==="TRANSITION_MILESTONE")return NextResponse.json(await transitionPortfolioMilestone({milestoneId:i.milestone_id,status:i.status,blockedReason:i.blocked_reason,evidence:i.evidence,note:i.note}));
  if(i.action==="ASSIGN_MEMBER")return NextResponse.json(await assignPortfolioMember({projectId:i.project_id,userId:i.user_id,projectRole:i.project_role,workstreamId:i.workstream_id}),{status:201});
  return NextResponse.json(await deactivatePortfolioMember({membershipId:i.membership_id,reason:i.reason}));
 }catch(error){return failure(error)}
}
