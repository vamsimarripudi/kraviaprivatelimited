import {NextResponse} from "next/server";
import {z} from "zod";
import {OfficeChatAttachmentError,downloadOfficeChatAttachment} from "@/lib/office/chat-attachment-server";
import {OfficePermissionError} from "@/lib/office/permission-engine";
import {OfficeChatError} from "@/lib/office/chat-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Attachment unavailable"},{status:404,headers});
 try{
  const result=await downloadOfficeChatAttachment(id);
  return new NextResponse(new Uint8Array(result.bytes),{headers:{
   ...headers,
   "Content-Type":result.mime,
   "Content-Disposition":'attachment; filename="'+result.filename.replaceAll('"',"")+'"',
   "Content-Security-Policy":"sandbox",
   "Referrer-Policy":"no-referrer",
  }});
 }catch(e){
  const status=e instanceof OfficeChatAttachmentError||e instanceof OfficePermissionError||
    e instanceof OfficeChatError?e.status:500;
  return NextResponse.json({detail:status===404||status===403?"Attachment unavailable":"File retrieval failed"},
   {status:status===403?404:status,headers});
 }
}
