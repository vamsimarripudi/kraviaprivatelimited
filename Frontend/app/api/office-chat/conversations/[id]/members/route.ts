import {NextResponse} from "next/server";
import {z} from "zod";
import {getOfficeChatMembers,addOfficeChatGroupMember,OfficeChatError} from "@/lib/office/chat-server";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
type Params={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Params){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Conversation unavailable"},{status:404,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await getOfficeChatMembers(id),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({detail:e instanceof OfficeChatError?e.message:"Conversation unavailable"},
  {status:e instanceof OfficeChatError?e.status:500,headers:{"Cache-Control":"no-store"}});}
}

const addSchema=z.object({user_id:z.string().uuid()}).strict();
export async function POST(request:Request,{params}:Params){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json(
  {detail:"Cross-origin membership action denied"},{status:403,headers:{"Cache-Control":"no-store"}});
 const {id}=await params;
 const input=addSchema.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!input.success)return NextResponse.json(
  {detail:"Invalid group member"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await addOfficeChatGroupMember(id,input.data.user_id),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json(
  {detail:error instanceof OfficeChatError?error.message:"Group membership unavailable"},
  {status:error instanceof OfficeChatError?error.status:500,headers:{"Cache-Control":"no-store"}});}
}
