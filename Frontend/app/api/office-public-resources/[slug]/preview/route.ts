import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireResourceOwner } from "@/lib/public-access/owner";
import { publicAccessSql } from "@/lib/public-access/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const HEADERS={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
type Props={params:Promise<{slug:string}>};
export async function GET(_request:Request,{params}:Props){
  const {slug}=await params;
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))
    return new Response("Not found",{status:404,headers:HEADERS});
  const owner=await requireResourceOwner().catch(()=>null);
  if(!owner)return NextResponse.json({error:"Owner MFA required."},{status:403,headers:HEADERS});
  try{
    const sql=publicAccessSql();
    const rows=await sql`select file_name,mime_type,byte_size,checksum_sha256,encode(data,'base64') as encoded
      from public_access.resources where slug=${slug} and status in ('DRAFT','PUBLISHED','RETIRED') limit 1`;
    const file=rows[0];
    if(!file)return new Response("Not found",{status:404,headers:HEADERS});
    const bytes=Buffer.from(String(file.encoded),"base64");
    const expected=String(file.checksum_sha256);
    if(bytes.length!==Number(file.byte_size)||bytes.length>2*1024*1024||
       createHash("sha256").update(bytes).digest("hex")!==expected)
       return new Response("Resource integrity error",{status:503,headers:HEADERS});
    const name=String(file.file_name).replace(/[^A-Za-z0-9._-]/g,"_").slice(0,128);
    return new Response(new Uint8Array(bytes),{headers:{
      ...HEADERS,"Content-Type":String(file.mime_type),
      "Content-Disposition":`attachment; filename="${name}"`,
      "Content-Length":String(bytes.length),
    }});
  }catch{return new Response("Resource unavailable.",{status:503,headers:HEADERS});}
}
