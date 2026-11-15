import {NextResponse} from "next/server";
import {z} from "zod";
import {OfficeChatError,markOfficeChatDelivered} from "@/lib/office/chat-server";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=z.string().uuid();
const input=z.object({message_ids:z.array(uuid).min(1).max(100)}).strict();
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function POST(request:Request,{params}:Context){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json(
  {detail:"Cross-origin receipt denied"},{status:403,headers});
 const {id}=await params;
 if(!uuid.safeParse(id).success)return NextResponse.json({detail:"Not found"},{status:404,headers});
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid message receipt batch"},{status:400,headers});
 try{return NextResponse.json(await markOfficeChatDelivered(id,parsed.data.message_ids),{headers});}
 catch(error){return NextResponse.json({detail:error instanceof OfficeChatError?error.message:"Receipt unavailable"},
  {status:error instanceof OfficeChatError?error.status:503,headers});}
}
