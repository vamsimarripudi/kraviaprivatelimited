import {NextResponse} from "next/server";
import {z} from "zod";
import {OfficeChatAttachmentError,discardOfficeChatDraftAttachment} from "@/lib/office/chat-attachment-server";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function DELETE(request:Request,{params}:Context){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin attachment cancellation denied"},{status:403,headers});
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Attachment unavailable"},{status:404,headers});
 try{return NextResponse.json(await discardOfficeChatDraftAttachment(id),{headers});}
 catch(error){
  const status=error instanceof OfficeChatAttachmentError?error.status:503;
  return NextResponse.json({detail:status===404?"Attachment unavailable":"Unable to cancel private draft"},{status,headers});
 }
}
