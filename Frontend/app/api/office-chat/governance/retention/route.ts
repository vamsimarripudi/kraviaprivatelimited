import {NextResponse} from "next/server";
import {getOfficeConnectRetention,OfficeConnectRetentionError} from "@/lib/office/connect-retention-server";
export const dynamic="force-dynamic";
export async function GET(){
 try{return NextResponse.json(await getOfficeConnectRetention(),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({
  detail:error instanceof OfficeConnectRetentionError?error.message:"Retention register unavailable",
 },{status:error instanceof OfficeConnectRetentionError?error.status:500,
  headers:{"Cache-Control":"no-store"}});}
}
