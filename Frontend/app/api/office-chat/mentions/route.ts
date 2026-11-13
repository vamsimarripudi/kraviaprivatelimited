import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {listOfficeChatMentions,markOfficeChatMentionRead,OfficeChatError} from "@/lib/office/chat-server";
const schema=z.object({message_id:z.string().uuid()}).strict();
function failure(e:unknown){return NextResponse.json({detail:e instanceof OfficeChatError?e.message:"Mentions unavailable"},
 {status:e instanceof OfficeChatError?e.status:500,headers:{"Cache-Control":"no-store"}});}
export async function GET(){
 try{return NextResponse.json(await listOfficeChatMentions(),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return failure(e);}
}
export async function PATCH(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin operation denied"},
 {status:403,headers:{"Cache-Control":"no-store"}});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid mention"},
 {status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await markOfficeChatMentionRead(parsed.data.message_id),
   {headers:{"Cache-Control":"no-store"}});}
 catch(e){return failure(e);}
}
