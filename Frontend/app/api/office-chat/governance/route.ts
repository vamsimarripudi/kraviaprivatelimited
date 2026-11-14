import {NextResponse} from "next/server";
import {getOfficeConnectGovernance,OfficeConnectGovernanceError} from "@/lib/office/connect-governance-server";
export const dynamic="force-dynamic";
export async function GET(){
 try{return NextResponse.json(await getOfficeConnectGovernance(),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({
  detail:error instanceof OfficeConnectGovernanceError?error.message:"Governance projection unavailable",
 },{status:error instanceof OfficeConnectGovernanceError?error.status:500,
  headers:{"Cache-Control":"no-store"}});}
}
