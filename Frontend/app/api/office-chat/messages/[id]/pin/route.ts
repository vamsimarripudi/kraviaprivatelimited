import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {OfficeChatError,setOfficeChatMessagePin} from "@/lib/office/chat-server";
type Context={params:Promise<{id:string}>};
const schema=z.object({pin:z.boolean()}).strict();
export async function POST(request:Request,{params}:Context){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin pin action denied"},
  {status:403,headers:{"Cache-Control":"no-store"}});
 const {id}=await params;
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!input.success)return NextResponse.json(
  {detail:"Invalid pin action"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await setOfficeChatMessagePin(id,input.data.pin),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({
  detail:error instanceof OfficeChatError?error.message:"Message pin unavailable",
 },{status:error instanceof OfficeChatError?error.status:500,headers:{"Cache-Control":"no-store"}});}
}
