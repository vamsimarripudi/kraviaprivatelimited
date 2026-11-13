import {NextResponse} from "next/server";
import {z} from "zod";
import {getOfficeChatMembers,OfficeChatError} from "@/lib/office/chat-server";
type Params={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Params){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Conversation unavailable"},{status:404,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await getOfficeChatMembers(id),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({detail:e instanceof OfficeChatError?e.message:"Conversation unavailable"},
  {status:e instanceof OfficeChatError?e.status:500,headers:{"Cache-Control":"no-store"}});}
}
