import {NextResponse} from "next/server";
import {z} from "zod";
import {requireOfficeActor,OfficePermissionError} from "@/lib/office/permission-engine";
import {OfficeVaultAccessError,requireOfficeVaultRecord} from "@/lib/office/vault-access-server";
import {downloadOfficeDocumentRender,OfficeDocumentStudioError} from "@/lib/office/document-studio-server";
export const dynamic="force-dynamic";
type Props={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Props){
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)
  return NextResponse.json({detail:"Resource unavailable"},{status:404,headers:{"Cache-Control":"no-store"}});
 try{
  const current=await requireOfficeActor();
  const {data:render,error}=await current.admin.from("office_document_renders")
    .select("document_instance_id,output_format,mime_type,status").eq("id",id).maybeSingle();
  if(error)throw new OfficeVaultAccessError(503,"Document authority unavailable");
  if(!render||render.output_format!=="PDF"||render.mime_type!=="application/pdf"||
   !["GENERATED","SIGNED"].includes(render.status))
   throw new OfficeVaultAccessError(404,"Resource unavailable");
  await requireOfficeVaultRecord({category:"documents",recordId:String(render.document_instance_id),action:"PREVIEW"});
  const file=await downloadOfficeDocumentRender(id);
  return new NextResponse(new Uint8Array(file.bytes),{headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":'inline; filename="'+file.filename.replaceAll('"',"")+'"',
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
    "Content-Security-Policy":"sandbox; frame-ancestors 'self'; default-src 'none'",
    "ETag":'"'+file.sha256+'"',
  }});
 }catch(e){
  const code=e instanceof OfficeVaultAccessError||e instanceof OfficePermissionError||
     e instanceof OfficeDocumentStudioError?e.status:500;
  return NextResponse.json({detail:code===403||code===404?"Resource unavailable":"Protected preview unavailable"},
   {status:code===403?404:code,headers:{"Cache-Control":"no-store"}});
 }
}
