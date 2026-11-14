import {NextResponse} from "next/server";
import {z} from "zod";
import {getOfficeChatTyping,setOfficeChatTyping} from "@/lib/office/chat-presence-server";
import {OfficeChatError} from "@/lib/office/chat-server";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=z.string().uuid();
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
function failure(error:unknown){
 return NextResponse.json({detail:error instanceof OfficeChatError?error.message:"Typing unavailable"},
  {status:error instanceof OfficeChatError?error.status:503,headers});
}
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(!uuid.safeParse(id).success)
  return NextResponse.json({detail:"Conversation unavailable"},{status:404,headers});
 try{return NextResponse.json(await getOfficeChatTyping(id),{headers});}
 catch(error){return failure(error);}
}
const payload=z.object({typing:z.boolean()}).strict();
export async function POST(request:Request,{params}:Context){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin typing signals denied"},{status:403,headers});
 const {id}=await params;
 if(!uuid.safeParse(id).success)
  return NextResponse.json({detail:"Conversation unavailable"},{status:404,headers});
 const input=payload.safeParse(await request.json().catch(()=>null));
 if(!input.success)
  return NextResponse.json({detail:"Invalid transient typing state"},{status:400,headers});
 try{return NextResponse.json(await setOfficeChatTyping(id,input.data.typing),{headers});}
 catch(error){return failure(error);}
}
