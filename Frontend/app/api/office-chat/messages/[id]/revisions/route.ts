import {NextResponse} from "next/server";
import {z} from "zod";
import {getOfficeChatMessageRevisions,OfficeChatError} from "@/lib/office/chat-server";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)return NextResponse.json(
  {detail:"Message unavailable"},{status:404,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await getOfficeChatMessageRevisions(id),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({
  detail:error instanceof OfficeChatError?error.message:"Revision history unavailable"
 },{status:error instanceof OfficeChatError?error.status:500,headers:{"Cache-Control":"no-store"}});}
}
