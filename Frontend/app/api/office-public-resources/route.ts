import { NextResponse } from "next/server";
import { z } from "zod";
import { requireResourceOwner } from "@/lib/public-access/owner";
import { inspectPublicResource } from "@/lib/public-access/inspect-resource";
import { publicAccessSql } from "@/lib/public-access/db";
import { sameOrigin } from "@/lib/public-access/auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const slugPattern=/^[a-z0-9][a-z0-9-]{2,79}$/;
const updateSchema=z.object({slug:z.string().regex(slugPattern),action:z.enum(["PUBLISH","RETIRE"])}).strict();

function unavailable(){return NextResponse.json({error:"Public resources temporarily unavailable."},{status:503});}
async function ownerOnly(){
  try{return await requireResourceOwner();}catch{return null;}
}
export async function GET(){
 const owner=await ownerOnly();
 if(!owner)return NextResponse.json({error:"Authorised KRAVIA Office owner access required."},{status:403});
 try{
  const sql=publicAccessSql();
  const records=await sql`select slug,title,summary,file_name,mime_type,byte_size,status,
    checksum_sha256,created_at,published_at,created_by,reviewed_by
    from public_access.resources order by created_at desc limit 100`;
  return NextResponse.json({resources:records},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return unavailable();}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
 const owner=await ownerOnly();
 if(!owner)return NextResponse.json({error:"Owner MFA is required."},{status:403});
 const length=Number(request.headers.get("content-length")||0);
 if(length>2_400_000)return NextResponse.json({error:"Upload is too large."},{status:413});
 try{
  const input=await request.formData();
  const file=input.get("file"),slug=String(input.get("slug")||"").trim(),
    title=String(input.get("title")||"").trim(),
    summary=String(input.get("summary")||"").trim();
  if(!(file instanceof File)||!slugPattern.test(slug)||title.length<5||title.length>160||
     summary.length<10||summary.length>1200) {
    return NextResponse.json({error:"Provide a valid slug, title, summary and resource file."},{status:400});
  }
  const content=new Uint8Array(await file.arrayBuffer());
  const verdict=inspectPublicResource(content,file.type);
  if(!verdict.valid)return NextResponse.json({error:verdict.reason},{status:400});
  const filename=file.name.replace(/[^A-Za-z0-9._-]/g,"_").replace(/^[._-]+/,"").slice(0,128);
  if(filename.length<3)return NextResponse.json({error:"Invalid file name."},{status:400});
  const sql=publicAccessSql();
  await sql`insert into public_access.resources
    (slug,title,summary,file_name,mime_type,data,byte_size,checksum_sha256,status,created_by)
    values(${slug},${title},${summary},${filename},${file.type},
      decode(${Buffer.from(content).toString("hex")},'hex'),${content.length},${verdict.sha256},
      'DRAFT',${owner.userId})`;
  return NextResponse.json({created:true,status:"DRAFT",slug},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch{return unavailable();}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
 const owner=await ownerOnly();
 if(!owner)return NextResponse.json({error:"Owner MFA is required."},{status:403});
 const input=updateSchema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Invalid publication decision."},{status:400});
 try{
  const sql=publicAccessSql();
  const rows=input.data.action==="PUBLISH"?
    await sql`update public_access.resources set status='PUBLISHED',published_at=now(),
       reviewed_by=${owner.userId} where slug=${input.data.slug} and status='DRAFT'
       and byte_size=octet_length(data) returning slug,status`:
    await sql`update public_access.resources set status='RETIRED'
       where slug=${input.data.slug} and status='PUBLISHED' returning slug,status`;
  if(!rows.length)return NextResponse.json({error:"Resource is missing or its status changed."},{status:409});
  return NextResponse.json({slug:input.data.slug,status:input.data.action==="PUBLISH"?"PUBLISHED":"RETIRED"},
    {headers:{"Cache-Control":"no-store"}});
 }catch{return unavailable();}
}
