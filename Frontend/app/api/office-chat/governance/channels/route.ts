import {NextResponse} from "next/server";
import {getOfficeConnectChannelGovernance,OfficeConnectGovernanceError} from "@/lib/office/connect-governance-server";
export const dynamic="force-dynamic";
export async function GET(){
 try{return NextResponse.json(await getOfficeConnectChannelGovernance(),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({
  detail:error instanceof OfficeConnectGovernanceError?error.message:"Channel governance unavailable",
 },{status:error instanceof OfficeConnectGovernanceError?error.status:500,
  headers:{"Cache-Control":"no-store"}});}
}
