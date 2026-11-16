import {NextResponse} from "next/server";
import {z} from "zod";
import {OfficeChatError} from "@/lib/office/chat-server";
import {getOfficeConversationOnlinePresence} from "@/lib/office/chat-online-server";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Conversation unavailable"},{status:404,headers});
 try{return NextResponse.json(await getOfficeConversationOnlinePresence(id),{headers});}
 catch(error){
  const status=error instanceof OfficeChatError?error.status:503;
  return NextResponse.json({detail:status===404?"Conversation unavailable":"Presence unavailable"},{status,headers});
 }
}
