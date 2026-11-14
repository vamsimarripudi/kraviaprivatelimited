import {NextResponse} from "next/server";
import {z} from "zod";
import {SecretLockerError} from "@/lib/office/vault-secret-server";
import {getOfficeVaultSecretIngress} from "@/lib/office/vault-secret-ingress";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Upload session unavailable"},{status:404,headers});
 try{return NextResponse.json(await getOfficeVaultSecretIngress(id),{headers});}
 catch(error){return NextResponse.json({
  detail:error instanceof SecretLockerError?error.message:"Upload session unavailable"
 },{status:error instanceof SecretLockerError?error.status:503,headers});}
}
