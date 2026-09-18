import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  assignAsset,
  disposeAsset,
  getAssetLifecycleOverview,
  OfficeAssetError,
  registerAssetLifecycle,
  transitionAsset,
  verifyAssetWipe,
} from "@/lib/office/asset-lifecycle-server";

const uuid=z.string().uuid();
const opt=(max:number)=>z.string().trim().max(max).optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("REGISTER"),asset_id:z.string().trim().min(1).max(120),device_id:uuid.optional(),supplier:opt(220),warranty_expires_on:z.string().date().optional(),condition:z.enum(["NEW","GOOD","FAIR","DAMAGED","LOST"]),security_wipe_required:z.boolean(),maintenance_due_on:z.string().date().optional()}),
 z.object({action:z.literal("ASSIGN"),asset_id:z.string().trim().min(1).max(120),user_id:uuid,location:opt(240),note:opt(2000)}),
 z.object({action:z.literal("TRANSITION"),asset_id:z.string().trim().min(1).max(120),lifecycle_action:z.enum(["REQUEST_RETURN","RETURN","SEND_REPAIR","RETURN_REPAIR","REQUEST_DISPOSAL","LOST"]),condition:z.enum(["NEW","GOOD","FAIR","DAMAGED","LOST"]).optional(),evidence:opt(1200),note:opt(2000)}),
 z.object({action:z.literal("VERIFY_WIPE"),asset_id:z.string().trim().min(1).max(120),evidence:z.string().trim().min(3).max(1200),note:opt(2000)}),
 z.object({action:z.literal("DISPOSE"),asset_id:z.string().trim().min(1).max(120),evidence:z.string().trim().min(3).max(1200),note:opt(2000)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeAssetError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Asset lifecycle operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getAssetLifecycleOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin asset mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid asset lifecycle operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="REGISTER")return NextResponse.json(await registerAssetLifecycle({assetId:i.asset_id,deviceId:i.device_id,supplier:i.supplier,warranty:i.warranty_expires_on,condition:i.condition,wipeRequired:i.security_wipe_required,maintenanceDue:i.maintenance_due_on}));
  if(i.action==="ASSIGN")return NextResponse.json(await assignAsset({assetId:i.asset_id,userId:i.user_id,location:i.location,note:i.note}));
  if(i.action==="TRANSITION")return NextResponse.json(await transitionAsset({assetId:i.asset_id,action:i.lifecycle_action,condition:i.condition,evidence:i.evidence,note:i.note}));
  if(i.action==="VERIFY_WIPE")return NextResponse.json(await verifyAssetWipe({assetId:i.asset_id,evidence:i.evidence,note:i.note}));
  return NextResponse.json(await disposeAsset({assetId:i.asset_id,evidence:i.evidence,note:i.note}));
 }catch(error){return failure(error)}
}
