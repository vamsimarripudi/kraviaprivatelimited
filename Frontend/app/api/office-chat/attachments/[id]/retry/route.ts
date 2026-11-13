import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {OfficeChatAttachmentError,retryOfficeChatAttachment} from "@/lib/office/chat-attachment-server";
type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"private, no-store"} as const;
export async function POST(request:Request,{params}:Context){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin scan retry denied"},{status:403,headers});
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Attachment unavailable"},{status:404,headers});
 try{
  const result=await retryOfficeChatAttachment(id);
  return NextResponse.json(result,{status:result.status==="CLEAN"?200:202,headers});
 }catch(e){
  return NextResponse.json({detail:e instanceof OfficeChatAttachmentError?e.message:"Scan verification unavailable"},
   {status:e instanceof OfficeChatAttachmentError?e.status:500,headers});
 }
}
