import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {getOfficeVaultSecretLocker,uploadOfficeVaultSecret,
 retryOfficeVaultSecretScan,reviewOfficeVaultSecret,SecretLockerError}
 from "@/lib/office/vault-secret-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const uuid=z.string().uuid();
function failure(error:unknown){
 const status=error instanceof SecretLockerError?error.status:503;
 return NextResponse.json({detail:status===404?"Document unavailable":
  error instanceof SecretLockerError?error.message:"Secret locker unavailable"},
  {status,headers});
}
export async function GET(){
 try{return NextResponse.json(await getOfficeVaultSecretLocker(),{headers});}
 catch(error){return failure(error);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin secret upload prohibited"},{status:403,headers});
 const declared=Number(request.headers.get("content-length")??"0");
 if(Number.isFinite(declared)&&declared>12_000_000)
  return NextResponse.json({detail:"Secret file exceeds upload limit"},{status:413,headers});
 const form=await request.formData().catch(()=>null);
 const file=form?.get("file"),title=form?.get("title"),
  classification=form?.get("classification"),documentId=form?.get("document_id");
 if(!(file instanceof File)||typeof title!=="string"||typeof classification!=="string"||
   (documentId!=null&&!(typeof documentId==="string"&&uuid.safeParse(documentId).success)))
  return NextResponse.json({detail:"Valid sealed document details are required"},{status:400,headers});
 try{
  const result=await uploadOfficeVaultSecret({file,title,classification,documentId:
   typeof documentId==="string"?documentId:undefined});
  return NextResponse.json(result,{status:result.status==="CLEAN"?201:202,headers});
 }catch(error){return failure(error);}
}
const action=z.discriminatedUnion("action",[
 z.object({action:z.literal("RETRY_SCAN"),version_id:uuid}).strict(),
 z.object({action:z.literal("REVIEW"),version_id:uuid,approve:z.boolean(),
  note:z.string().trim().min(12).max(2000)}).strict(),
]);
export async function PATCH(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin sealed-file mutation prohibited"},{status:403,headers});
 const input=action.safeParse(await request.json().catch(()=>null));
 if(!input.success)
  return NextResponse.json({detail:"Invalid sealed-file operation"},{status:400,headers});
 try{
  const result=input.data.action==="RETRY_SCAN"?
   await retryOfficeVaultSecretScan(input.data.version_id):
   await reviewOfficeVaultSecret({versionId:input.data.version_id,
    approve:input.data.approve,note:input.data.note});
  return NextResponse.json(result,{headers});
 }catch(error){return failure(error);}
}
