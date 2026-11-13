import {NextResponse} from "next/server";
import {OfficeChatAttachmentError,getOfficeChatSharedFiles} from "@/lib/office/chat-attachment-server";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  return NextResponse.json(await getOfficeChatSharedFiles(),{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){
  return NextResponse.json({detail:e instanceof OfficeChatAttachmentError?e.message:"Private files unavailable"},
   {status:e instanceof OfficeChatAttachmentError?e.status:500,headers:{"Cache-Control":"private, no-store"}});
 }
}
