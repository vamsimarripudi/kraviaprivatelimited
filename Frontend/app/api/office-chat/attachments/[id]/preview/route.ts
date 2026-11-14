import {NextResponse} from "next/server";
import {z} from "zod";
import {OfficeChatAttachmentError,downloadOfficeChatAttachment} from "@/lib/office/chat-attachment-server";
import {OfficePermissionError} from "@/lib/office/permission-engine";
import {OfficeChatError} from "@/lib/office/chat-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm"]);
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
 "Cross-Origin-Resource-Policy":"same-origin","Referrer-Policy":"no-referrer",
 "Content-Security-Policy":"sandbox"} as const;
export async function GET(_:Request,{params}:Context){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Preview unavailable"},{status:404,headers});
 try{
  // The canonical private read checks AAL2, active membership, CLEAN scanner
  // verdict, linked message, sha256 and emits a permanent read audit.
  const file=await downloadOfficeChatAttachment(id);
  if(!allowed.has(file.mime))
   return NextResponse.json({detail:"This attachment cannot be previewed"},{status:415,headers});
  const safeName=file.filename.replace(/[\u0000-\u001f\u007f\\"\\]/g,"_");
  return new NextResponse(new Uint8Array(file.bytes),{headers:{
   ...headers,"Content-Type":file.mime,
   "Content-Disposition":'inline; filename="'+safeName+'"',
  }});
 }catch(error){
  const status=error instanceof OfficeChatAttachmentError||error instanceof OfficePermissionError||
   error instanceof OfficeChatError?error.status:503;
  return NextResponse.json({detail:"Preview unavailable"},
   {status:status===401?401:status===503?503:404,headers});
 }
}
