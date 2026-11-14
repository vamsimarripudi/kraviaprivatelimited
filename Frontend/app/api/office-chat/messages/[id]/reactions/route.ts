import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {OfficeChatError,setOfficeChatMessageReaction} from "@/lib/office/chat-server";
type Context={params:Promise<{id:string}>};
const schema=z.object({emoji:z.enum(["👍","❤️","✅","🎉","👀","🤔"]),react:z.boolean()}).strict();
export async function POST(request:Request,{params}:Context){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin reaction denied"},
  {status:403,headers:{"Cache-Control":"no-store"}});
 const {id}=await params;
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!z.string().uuid().safeParse(id).success||!input.success)return NextResponse.json(
  {detail:"Invalid reaction"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await setOfficeChatMessageReaction(id,input.data.emoji,input.data.react),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({
  detail:error instanceof OfficeChatError?error.message:"Reaction unavailable",
 },{status:error instanceof OfficeChatError?error.status:500,headers:{"Cache-Control":"no-store"}});}
}
