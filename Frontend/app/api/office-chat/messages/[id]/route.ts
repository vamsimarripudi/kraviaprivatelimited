import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {editOfficeChatMessage,deleteOfficeChatMessage,OfficeChatError} from "@/lib/office/chat-server";
type Params={params:Promise<{id:string}>};
const schema=z.object({body:z.string().trim().min(1).max(4000)}).strict();
function failure(e:unknown){return NextResponse.json({detail:e instanceof OfficeChatError?e.message:"Message action unavailable"},
 {status:e instanceof OfficeChatError?e.status:500,headers:{"Cache-Control":"no-store"}});}
export async function PATCH(request:Request,{params}:Params){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin operation denied"},
 {status:403,headers:{"Cache-Control":"no-store"}});
 const {id}=await params;const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!parsed.success)return NextResponse.json({detail:"Invalid message"},
 {status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await editOfficeChatMessage(id,parsed.data.body),
 {headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}
}
export async function DELETE(request:Request,{params}:Params){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin operation denied"},
 {status:403,headers:{"Cache-Control":"no-store"}});
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)return NextResponse.json({detail:"Invalid message"},
 {status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await deleteOfficeChatMessage(id),
 {headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}
}
