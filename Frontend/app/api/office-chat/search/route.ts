import {NextResponse} from "next/server";
import {searchOfficeChatMessages,OfficeChatError} from "@/lib/office/chat-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const q=new URL(request.url).searchParams.get("q")??"";
 try{return NextResponse.json(await searchOfficeChatMessages(q),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({detail:e instanceof OfficeChatError?e.message:"Search unavailable"},
  {status:e instanceof OfficeChatError?e.status:500,headers:{"Cache-Control":"no-store"}});}
}
