import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentPublicAccount } from "@/lib/public-access/auth";
import { publicAccessSql } from "@/lib/public-access/db";
import { sendPublicMail } from "@/lib/public-access/mail";
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
  const rows=await sql`select title,file_name,mime_type,byte_size,checksum_sha256,encode(data,'base64') as encoded
    from public_access.resources where slug=${slug} and status='PUBLISHED' limit 1`;
  const file=rows[0];
  if(!file)return new Response("Not found",{status:404,headers});
  const content=Buffer.from(String(file.encoded),"base64");
  if(content.length!==Number(file.byte_size)||content.length>2097152||
     createHash("sha256").update(content).digest("hex")!==String(file.checksum_sha256))
    return new Response("Resource validation failed",{status:503,headers});
  const prior=await sql`select 1 from public_access.download_events
    where account_id=${account.id}::uuid and resource_slug=${slug} limit 1`;
  await sql`insert into public_access.download_events(account_id,resource_slug)
    values(${account.id}::uuid,${slug})`;
  // Send a transactional receipt on first access only; marketing opt-in is unaffected.
  if(!prior.length){
    await sendPublicMail({
      kind:"DOWNLOAD_RECEIPT",event_id:`download:${account.id}:${slug}`,
      recipient_email:account.email,recipient_name:account.displayName,
      resource_title:String(file.title),
    }).catch(()=>undefined);
  }
  return new Response(new Uint8Array(content),{status:200,headers:{
    ...headers,"Content-Type":String(file.mime_type),
    "Content-Disposition":`attachment; filename="${String(file.file_name).replace(/[^A-Za-z0-9._-]/g,"_")}"`,
    "Content-Length":String(content.length),
  }});
 }catch{
  return new Response("Resource temporarily unavailable.",{status:503,headers});
 }
}
