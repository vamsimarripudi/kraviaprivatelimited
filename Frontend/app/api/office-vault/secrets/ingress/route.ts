import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {SecretLockerError} from "@/lib/office/vault-secret-server";
import {startOfficeVaultSecretIngress,completeOfficeVaultSecretIngress,abortOfficeVaultSecretIngress}
 from "@/lib/office/vault-secret-ingress";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const uuid=z.string().uuid();
const start=z.object({
 action:z.literal("START"),title:z.string().trim().min(3).max(180),
 classification:z.enum(["CONFIDENTIAL","RESTRICTED","BOARD","FINANCE","HR","LEGAL","SECURITY"]),
 filename:z.string().min(1).max(250),
 mime:z.string().min(1).max(150),
 bytes:z.number().int().min(1).max(10485760),
 sha256:z.string().regex(/^[a-f0-9]{64}$/),
 document_id:uuid.optional(),
}).strict();
const complete=z.object({action:z.literal("COMPLETE"),session_id:uuid}).strict();
const abort=z.object({action:z.literal("ABORT"),session_id:uuid}).strict();
const action=z.discriminatedUnion("action",[start,complete,abort]);
function failure(error:unknown){
 return NextResponse.json({detail:error instanceof SecretLockerError?error.message:
  "Private encrypted upload unavailable"},
  {status:error instanceof SecretLockerError?error.status:503,headers});
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin upload prohibited"},{status:403,headers});
 const size=Number(request.headers.get("content-length")??"0");
 if(Number.isFinite(size)&&size>8192)
  return NextResponse.json({detail:"Invalid upload control length"},{status:413,headers});
 const parsed=action.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid upload control request"},{status:400,headers});
 try{
  const input=parsed.data;
  if(input.action==="START"){
   const result=await startOfficeVaultSecretIngress({
    title:input.title,classification:input.classification,filename:input.filename,
    mime:input.mime,bytes:input.bytes,sha256:input.sha256,documentId:input.document_id,
   });
   return NextResponse.json(result,{status:201,headers});
  }
  if(input.action==="COMPLETE")
   return NextResponse.json(await completeOfficeVaultSecretIngress(input.session_id),{headers});
  return NextResponse.json(await abortOfficeVaultSecretIngress(input.session_id),{headers});
 }catch(e){return failure(e);}
}
