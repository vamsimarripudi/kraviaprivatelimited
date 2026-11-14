import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {OfficeChatAttachmentError,uploadOfficeChatAttachment} from "@/lib/office/chat-attachment-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"} as const;
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin private attachment upload denied"},{status:403,headers});
 const declared=Number(request.headers.get("content-length")??"0");
 if(Number.isFinite(declared)&&declared>11_500_000)
  return NextResponse.json({detail:"Attachment exceeds the 10 MiB file limit"},{status:413,headers});
 const form=await request.formData().catch(()=>null);
 const file=form?.get("file");
 const conversation=form?.get("conversation_id");
 if(!(file instanceof File)||typeof conversation!=="string"||
    !z.string().uuid().safeParse(conversation).success)
   return NextResponse.json({detail:"Valid conversation and attachment are required"},{status:400,headers});
 try{
  const result=await uploadOfficeChatAttachment({conversationId:conversation,file});
  return NextResponse.json(result,{status:result.status==="CLEAN"?201:202,headers});
 }catch(e){
  return NextResponse.json({detail:e instanceof OfficeChatAttachmentError?e.message:"Private upload unavailable"},
   {status:e instanceof OfficeChatAttachmentError?e.status:500,headers});
 }
}
