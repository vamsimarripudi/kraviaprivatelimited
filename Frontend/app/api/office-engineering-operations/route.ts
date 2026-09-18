import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  cancelOncallRotation,
  createMaintenanceWindow,
  createOncallRotation,
  executeMaintenanceWindow,
  getEngineeringOperationsOverview,
  OfficeEngineeringOperationsError,
  reviewMaintenanceWindow,
  verifyMaintenanceWindow,
} from "@/lib/office/engineering-operations-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_ONCALL"),service_id:uuid,primary_user_id:uuid,secondary_user_id:uuid.optional(),starts_at:z.string().datetime({offset:true}),ends_at:z.string().datetime({offset:true}),note:opt(2000)}),
 z.object({action:z.literal("CANCEL_ONCALL"),rotation_id:uuid,reason:z.string().trim().min(3).max(2000)}),
 z.object({action:z.literal("CREATE_MAINTENANCE"),service_id:uuid,title:z.string().trim().min(3).max(220),reason:z.string().trim().min(3).max(8000),expected_impact:z.string().trim().min(3).max(8000),implementation_plan:z.string().trim().min(3).max(10000),rollback_plan:z.string().trim().min(3).max(10000),owner_user_id:uuid,starts_at:z.string().datetime({offset:true}),ends_at:z.string().datetime({offset:true})}),
 z.object({action:z.literal("REVIEW_MAINTENANCE"),maintenance_id:uuid,decision:z.enum(["APPROVED","REJECTED"]),approval_reference:opt(1200),note:opt(2000)}),
 z.object({action:z.literal("EXECUTE_MAINTENANCE"),maintenance_id:uuid,status:z.enum(["IN_PROGRESS","ROLLED_BACK","CANCELLED"]),evidence:opt(1200),note:opt(2000)}),
 z.object({action:z.literal("VERIFY_MAINTENANCE"),maintenance_id:uuid,evidence:z.string().trim().min(3).max(1200),health_reference:z.string().trim().min(3).max(1200),note:opt(2000)}),
]);
function failure(error:unknown){const status=error instanceof OfficeEngineeringOperationsError?error.status:500;return NextResponse.json({detail:error instanceof Error?error.message:"Engineering operations failed"},{status,headers:{"Cache-Control":"no-store"}})}
export async function GET(){try{return NextResponse.json(await getEngineeringOperationsOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin engineering-operations mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid engineering-operations request"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_ONCALL")return NextResponse.json(await createOncallRotation({serviceId:i.service_id,primaryUserId:i.primary_user_id,secondaryUserId:i.secondary_user_id,startsAt:i.starts_at,endsAt:i.ends_at,note:i.note}),{status:201});
  if(i.action==="CANCEL_ONCALL")return NextResponse.json(await cancelOncallRotation({rotationId:i.rotation_id,reason:i.reason}));
  if(i.action==="CREATE_MAINTENANCE")return NextResponse.json(await createMaintenanceWindow({serviceId:i.service_id,title:i.title,reason:i.reason,impact:i.expected_impact,implementation:i.implementation_plan,rollback:i.rollback_plan,ownerUserId:i.owner_user_id,startsAt:i.starts_at,endsAt:i.ends_at}),{status:201});
  if(i.action==="REVIEW_MAINTENANCE")return NextResponse.json(await reviewMaintenanceWindow({maintenanceId:i.maintenance_id,decision:i.decision,reference:i.approval_reference,note:i.note}));
  if(i.action==="EXECUTE_MAINTENANCE")return NextResponse.json(await executeMaintenanceWindow({maintenanceId:i.maintenance_id,action:i.status,evidence:i.evidence,note:i.note}));
  return NextResponse.json(await verifyMaintenanceWindow({maintenanceId:i.maintenance_id,evidence:i.evidence,health:i.health_reference,note:i.note}));
 }catch(error){return failure(error)}
}
