import {NextResponse} from "next/server";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {acknowledgeOfficeChatInbox,OfficeChatError} from "@/lib/office/chat-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))return NextResponse.json(
    {detail:"Cross-origin inbox receipt denied"},{status:403,headers});
  try{return NextResponse.json(await acknowledgeOfficeChatInbox(),{headers});}
  catch(error){return NextResponse.json(
    {detail:error instanceof OfficeChatError?error.message:"Inbox delivery unavailable"},
    {status:error instanceof OfficeChatError?error.status:503,headers});}
}
