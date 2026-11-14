import {NextResponse} from "next/server";
import {z} from "zod";
import {downloadOfficeVaultSecret,SecretLockerError} from "@/lib/office/vault-secret-server";
import {streamSealedDocument} from "@/lib/office/vault-secret-byte-stream";
import {privateDocumentDisposition} from "@/lib/office/vault-download-disposition";
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
  const disposition=privateDocumentDisposition(file.filename);
  return new Response(streamSealedDocument(file.bytes),{headers:{
   ...headers,
   "Content-Type":file.mime,
   "Content-Disposition":disposition,
   "Content-Security-Policy":"sandbox",
   "Referrer-Policy":"no-referrer",
  }});
 }catch(error){
  const status=error instanceof SecretLockerError?error.status:503;
  return NextResponse.json({detail:"Document unavailable"},
   {status:status===403?404:status,headers});
 }
}
