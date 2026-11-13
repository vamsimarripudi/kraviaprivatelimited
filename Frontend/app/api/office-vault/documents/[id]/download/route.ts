import {NextResponse} from "next/server";
import {z} from "zod";
import {downloadOfficeDocumentRender,OfficeDocumentStudioError} from "@/lib/office/document-studio-server";
import {OfficeVaultAccessError,requireOfficeVaultRecord} from "@/lib/office/vault-access-server";
import {requireOfficeActor,OfficePermissionError} from "@/lib/office/permission-engine";
export const dynamic="force-dynamic";
type Props={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Props){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)return NextResponse.json({detail:"Resource unavailable"},
  {status:404,headers:{"Cache-Control":"no-store"}});
 try{
  const current=await requireOfficeActor();
  const {data:render,error}=await current.admin.from("office_document_renders")
    .select("document_instance_id").eq("id",id).maybeSingle();
  if(error)throw new OfficeVaultAccessError(503,"Document authority unavailable");
  if(!render)throw new OfficeVaultAccessError(404,"Resource unavailable");
  await requireOfficeVaultRecord({category:"documents",recordId:String(render.document_instance_id),action:"DOWNLOAD"});
  const file=await downloadOfficeDocumentRender(id);
  return new NextResponse(new Uint8Array(file.bytes),{headers:{
   "Content-Type":file.mime_type,
   "Content-Disposition":'attachment; filename="'+file.filename.replaceAll('"',"")+'"',
   "Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"sandbox",
   "ETag":'"'+file.sha256+'"',
  }});
 }catch(error){
  const code=error instanceof OfficeVaultAccessError||error instanceof OfficeDocumentStudioError||
    error instanceof OfficePermissionError?error.status:500;
  return NextResponse.json({detail:code===404||code===403?"Resource unavailable":"Document retrieval failed"},
   {status:code===403?404:code,headers:{"Cache-Control":"no-store"}});
 }
}
