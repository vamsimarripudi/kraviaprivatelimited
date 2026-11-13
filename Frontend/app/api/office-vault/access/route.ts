import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
 OfficeVaultAccessError,getOfficeVaultAccessCenter,requestOfficeVaultAccess,
 reviewOfficeVaultAccess,revokeOfficeVaultAccess,
} from "@/lib/office/vault-access-server";
export const dynamic="force-dynamic";
const uuid=z.string().uuid();
const mutation=z.discriminatedUnion("action",[
 z.object({action:z.literal("REQUEST"),category:z.enum(["identity","registrations","banking","legal","people","technology","documents","custody"]),
  record_id:uuid.optional(),operation:z.enum(["READ","PREVIEW","DOWNLOAD"]),
  justification:z.string().trim().min(15).max(500),until:z.string().datetime({offset:true})}).strict(),
 z.object({action:z.literal("REVIEW"),request_id:uuid,approve:z.boolean(),note:z.string().trim().max(2000)}).strict(),
 z.object({action:z.literal("REVOKE"),grant_id:uuid,reason:z.string().trim().min(10).max(2000)}).strict(),
]);
function failure(e:unknown){
 return NextResponse.json({detail:e instanceof OfficeVaultAccessError?e.message:"Vault operation failed"},
 {status:e instanceof OfficeVaultAccessError?e.status:500,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){
 try{return NextResponse.json(await getOfficeVaultAccessCenter(),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return failure(e);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin request forbidden"},{status:403,headers:{"Cache-Control":"no-store"}});
 const parsed=mutation.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid Vault access action"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{
  const p=parsed.data;
  if(p.action==="REQUEST")return NextResponse.json(await requestOfficeVaultAccess({
   category:p.category,recordId:p.record_id,action:p.operation,justification:p.justification,until:p.until
  }),{status:201,headers:{"Cache-Control":"no-store"}});
  if(p.action==="REVIEW")return NextResponse.json(await reviewOfficeVaultAccess({
   requestId:p.request_id,approve:p.approve,note:p.note
  }),{headers:{"Cache-Control":"no-store"}});
  return NextResponse.json(await revokeOfficeVaultAccess({grantId:p.grant_id,reason:p.reason}),
   {headers:{"Cache-Control":"no-store"}});
 }catch(e){return failure(e);}
}
