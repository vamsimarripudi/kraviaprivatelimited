import {NextResponse} from "next/server";
import {z} from "zod";
import {downloadOfficeVaultSecret,SecretLockerError} from "@/lib/office/vault-secret-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Document unavailable"},{status:404,headers});
 try{
  const file=await downloadOfficeVaultSecret(id,"DOWNLOAD");
  const name=file.filename.replaceAll('"',"").replaceAll("\\","_");
  return new NextResponse(new Uint8Array(file.bytes),{headers:{
   ...headers,
   "Content-Type":file.mime,
   "Content-Disposition":'attachment; filename="'+name+'"',
   "Content-Security-Policy":"sandbox",
   "ETag":'"'+file.sha256+'"',
  }});
 }catch(error){
  const status=error instanceof SecretLockerError?error.status:503;
  return NextResponse.json({detail:"Document unavailable"},
   {status:status===403?404:status,headers});
 }
}
