import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {getOfficeChatThread,sendOfficeChatReply,OfficeChatError} from "@/lib/office/chat-server";
type Params={params:Promise<{id:string}>};
const schema=z.object({body:z.string().trim().min(1).max(4000),client_nonce:z.string().uuid()}).strict();
function failure(e:unknown){return NextResponse.json({detail:e instanceof OfficeChatError?e.message:"Thread unavailable"},
 {status:e instanceof OfficeChatError?e.status:500,headers:{"Cache-Control":"no-store"}});}
export async function GET(_:Request,{params}:Params){
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)return failure(new OfficeChatError(404,"Thread unavailable"));
 try{return NextResponse.json(await getOfficeChatThread(id),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return failure(e);}
}
export async function POST(request:Request,{params}:Params){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin operation denied"},
   {status:403,headers:{"Cache-Control":"no-store"}});
 const {id}=await params;
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!parsed.success)return NextResponse.json({detail:"Invalid reply"},
  {status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await sendOfficeChatReply(id,parsed.data.body,parsed.data.client_nonce),
  {status:201,headers:{"Cache-Control":"no-store"}});}
 catch(e){return failure(e);}
}
