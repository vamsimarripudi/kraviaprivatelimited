import { NextResponse } from "next/server";
import { getOfficeAuditExplorerOverview, OfficeAuditExplorerError } from "@/lib/office/audit-explorer-server";

export async function GET(){
 try{return NextResponse.json(await getOfficeAuditExplorerOverview(),{headers:{"Cache-Control":"no-store"}})}
 catch(error){
  const status=error instanceof OfficeAuditExplorerError?error.status:500;
  return NextResponse.json({detail:error instanceof Error?error.message:"Audit explorer unavailable"},{status,headers:{"Cache-Control":"no-store"}});
 }
}
