import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {OfficeChatError} from "@/lib/office/chat-server";
import {getMyOfficeChatOnlinePreferences,pulseMyOfficeChatOnline,saveMyOfficeChatOnlinePreferences} from "@/lib/office/chat-online-server";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const pulse=z.object({device_id:z.string().uuid(),online:z.boolean()}).strict();
const privacy=z.object({
 last_seen_visibility:z.enum(["COWORKERS","CONVERSATIONS","NOBODY"]),
 online_visibility:z.enum(["COWORKERS","SAME_AS_LAST_SEEN"]),
}).strict();
function failure(error:unknown){
 const status=error instanceof OfficeChatError?error.status:503;
 return NextResponse.json({detail:status===403?"Office presence access denied":"Presence unavailable"},{status,headers});
}
export async function GET(){
 try{return NextResponse.json(await getMyOfficeChatOnlinePreferences(),{headers});}
 catch(error){return failure(error);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin presence signal denied"},{status:403,headers});
 const parsed=pulse.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid device presence"},{status:400,headers});
 try{return NextResponse.json(await pulseMyOfficeChatOnline(parsed.data.device_id,parsed.data.online),{headers});}
 catch(error){return failure(error);}
}
export async function PUT(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin privacy update denied"},{status:403,headers});
 const parsed=privacy.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid privacy settings"},{status:400,headers});
 try{return NextResponse.json(await saveMyOfficeChatOnlinePreferences(parsed.data),{headers});}
 catch(error){return failure(error);}
}
