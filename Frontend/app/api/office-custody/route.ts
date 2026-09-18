import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  checkoutCustodyItem,
  createCustodyItem,
  getSecureCustodyOverview,
  markCustodyLost,
  OfficeCustodyError,
  returnCustodyItem,
  verifyCustodyReturn,
} from "@/lib/office/custody-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("CREATE_ITEM"),item_type:z.enum(["DSC_TOKEN","ORIGINAL_DOCUMENT","SHARE_CERTIFICATE","BANK_DOCUMENT","GOVERNMENT_CERTIFICATE","SECURITY_TOKEN","BACKUP_MEDIA","OTHER"]),title:z.string().trim().min(3).max(220),reference_no:opt(500),asset_id:opt(120),document_reference:opt(1200),custodian_user_id:uuid.optional(),storage_location:z.string().trim().min(2).max(500),classification:z.enum(["CONFIDENTIAL","RESTRICTED","LEGAL","BOARD","SECURITY"]),notes:opt(4000)}),
  z.object({action:z.literal("CHECKOUT"),item_id:uuid,to_user_id:uuid,purpose:z.string().trim().min(3).max(4000),related_reference:opt(1200),due_back_at:z.string().datetime({offset:true}).optional()}),
  z.object({action:z.literal("RETURN"),checkout_id:uuid,evidence:z.string().trim().min(3).max(1200)}),
  z.object({action:z.literal("VERIFY_RETURN"),checkout_id:uuid,evidence:z.string().trim().min(3).max(2000)}),
  z.object({action:z.literal("MARK_LOST"),checkout_id:uuid,evidence:z.string().trim().min(3).max(1200),note:opt(3000)}),
]);
function failure(error:unknown){
  const status=error instanceof OfficeCustodyError?error.status:500;
  return NextResponse.json({detail:error instanceof Error?error.message:"Secure-custody operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getSecureCustodyOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin custody mutation is not allowed"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid secure-custody operation"},{status:400});
  try{
    const i=parsed.data;
    if(i.action==="CREATE_ITEM")return NextResponse.json(await createCustodyItem({type:i.item_type,title:i.title,reference:i.reference_no,assetId:i.asset_id,documentReference:i.document_reference,custodianUserId:i.custodian_user_id,location:i.storage_location,classification:i.classification,notes:i.notes}),{status:201});
    if(i.action==="CHECKOUT")return NextResponse.json(await checkoutCustodyItem({itemId:i.item_id,toUserId:i.to_user_id,purpose:i.purpose,relatedReference:i.related_reference,dueBackAt:i.due_back_at}),{status:201});
    if(i.action==="RETURN")return NextResponse.json(await returnCustodyItem({checkoutId:i.checkout_id,evidence:i.evidence}));
    if(i.action==="VERIFY_RETURN")return NextResponse.json(await verifyCustodyReturn({checkoutId:i.checkout_id,evidence:i.evidence}));
    return NextResponse.json(await markCustodyLost({checkoutId:i.checkout_id,evidence:i.evidence,note:i.note}));
  }catch(error){return failure(error)}
}
