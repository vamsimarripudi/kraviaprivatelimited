import {NextResponse} from "next/server";
import {Buffer} from "node:buffer";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {SecretLockerError} from "@/lib/office/vault-secret-server";
import {SECRET_UPLOAD_PART_SIZE,uploadOfficeVaultSecretPart}
 from "@/lib/office/vault-secret-ingress";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function PUT(request:Request,{params}:{params:Promise<{id:string;index:string}>}){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin upload prohibited"},{status:403,headers});
 const {id,index}=await params;
 if(!z.string().uuid().safeParse(id).success||!/^(?:[0-9])$/.test(index))
  return NextResponse.json({detail:"Upload part unavailable"},{status:404,headers});
 if(request.headers.get("content-type")?.split(";")[0]!=="application/octet-stream")
  return NextResponse.json({detail:"Only private binary upload parts are accepted"},{status:415,headers});
 const declared=request.headers.get("content-length");
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>SECRET_UPLOAD_PART_SIZE))
  return NextResponse.json({detail:"Encrypted upload part exceeds one MiB"},{status:413,headers});
 if(!request.body)return NextResponse.json({detail:"Missing upload part"},{status:400,headers});
 const bounded=Buffer.alloc(SECRET_UPLOAD_PART_SIZE);
 let used=0;
 const reader=request.body.getReader();
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!value)continue;
   if(used+value.byteLength>SECRET_UPLOAD_PART_SIZE){
    value.fill(0);
    void reader.cancel().catch(()=>{});
    return NextResponse.json({detail:"Encrypted upload part exceeds one MiB"},{status:413,headers});
   }
   bounded.set(value,used);
   used+=value.byteLength;
   value.fill(0);
  }
  if(used===0)return NextResponse.json({detail:"Missing encrypted upload part"},{status:400,headers});
  const data=Buffer.from(bounded.subarray(0,used));
  try{
   const result=await uploadOfficeVaultSecretPart(id,Number(index),data);
   return NextResponse.json(result,{status:201,headers});
  }catch(error){
   return NextResponse.json({
    detail:error instanceof SecretLockerError?error.message:"Encrypted upload part unavailable"
   },{status:error instanceof SecretLockerError?error.status:503,headers});
  }
 }catch{
  return NextResponse.json({detail:"Encrypted upload stream could not be read"},{status:400,headers});
 }finally{
  bounded.fill(0);
  reader.releaseLock();
 }
}
