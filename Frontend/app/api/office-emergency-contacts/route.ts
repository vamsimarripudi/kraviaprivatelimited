import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  confirmOwnEmergencyContact,
  deactivateOwnEmergencyContact,
  getEmergencyContactOverview,
  OfficeEmergencyContactError,
  revealEmergencyContact,
  upsertOwnEmergencyContact,
} from "@/lib/office/emergency-contacts-server";

const uuid=z.string().uuid();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("UPSERT"),contact_id:uuid.optional(),priority:z.number().int().min(1).max(3),name:z.string().trim().min(2).max(180),relationship:z.string().trim().min(2).max(100),phone:z.string().regex(/^\+[1-9][0-9]{7,14}$/),email:z.string().email().max(320).optional(),notes:z.string().trim().max(1000).optional(),attest:z.literal(true)}),
  z.object({action:z.literal("CONFIRM"),contact_id:uuid}),
  z.object({action:z.literal("DEACTIVATE"),contact_id:uuid,reason:z.string().trim().min(3).max(1000)}),
  z.object({action:z.literal("REVEAL"),contact_id:uuid}),
]);
function failure(error:unknown){
  const status=error instanceof OfficeEmergencyContactError?error.status:500;
  return NextResponse.json({detail:error instanceof Error?error.message:"Emergency-contact operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getEmergencyContactOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin emergency-contact mutation is not allowed"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid emergency-contact operation"},{status:400});
  try{
    const i=parsed.data;
    if(i.action==="UPSERT")return NextResponse.json(await upsertOwnEmergencyContact({contactId:i.contact_id,priority:i.priority,name:i.name,relationship:i.relationship,phone:i.phone,email:i.email,notes:i.notes,attest:true}),{status:i.contact_id?200:201});
    if(i.action==="CONFIRM")return NextResponse.json(await confirmOwnEmergencyContact(i.contact_id));
    if(i.action==="DEACTIVATE")return NextResponse.json(await deactivateOwnEmergencyContact({contactId:i.contact_id,reason:i.reason}));
    return NextResponse.json(await revealEmergencyContact(i.contact_id));
  }catch(error){return failure(error)}
}
