import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sendPublicMail } from "@/lib/public-access/mail";
import { currentPublicAccount } from "@/lib/public-access/auth";
import { publicAccessSql } from "@/lib/public-access/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
type Props={params:Promise<{slug:string}>};
export async function GET(request:NextRequest,{params}:Props){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))return new Response("Not found",{status:404});
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
 try{
  const sql=publicAccessSql();
  const resource=await sql`select slug from public_access.resources
    where slug=${slug} and status='PUBLISHED' limit 1`;
  if(!resource.length)return new Response("Not found",{status:404,headers});
  const account=await currentPublicAccount();
  if(!account){
    const target=new URL("/join",request.url);
    target.searchParams.set("next",`/api/public-resources/${slug}/download`);
    return NextResponse.redirect(target,303);
  }
  const rows=await sql`select file_name,mime_type,byte_size,checksum_sha256,encode(data,'base64') as encoded
    from public_access.resources where slug=${slug} and status='PUBLISHED' limit 1`;
  const file=rows[0];
  if(!file)return new Response("Not found",{status:404,headers});
  const content=Buffer.from(String(file.encoded),"base64");
  if(content.length!==Number(file.byte_size)||content.length>2097152||
    createHash("sha256").update(content).digest("hex")!==String(file.checksum_sha256))
    return new Response("Resource validation failed",{status:503,headers});
  const audit=await sql`insert into public_access.download_events(account_id,resource_slug)
    values(${account.id}::uuid,${slug}) returning id`;
  if(audit[0]?.id){
    // A delivery failure does not revoke an otherwise authorised file download.
    await sendPublicMail({
      kind:"DOWNLOAD_RECEIPT",event_id:`public-download:${String(audit[0].id)}`,
      recipient_email:account.email,recipient_name:account.displayName,
      resource_title:String(file.file_name)
    }).catch(()=>undefined);
  }
  return new Response(new Uint8Array(content),{status:200,headers:{
    ...headers,"Content-Type":String(file.mime_type),
    "Content-Disposition":`attachment; filename="${String(file.file_name)}"`,
    "Content-Length":String(content.length),
  }});
 }catch{
  return new Response("Resource temporarily unavailable.",{status:503,headers});
 }
}
