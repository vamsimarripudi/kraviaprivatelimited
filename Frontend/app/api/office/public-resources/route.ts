import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {publicAccessSql} from "@/lib/public-access/db";
import {PublicPublisherError,requirePublicPublisher} from "@/lib/public-access/publisher";
import {sameOrigin} from "@/lib/public-access/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const maxBytes=2*1024*1024;
const types=new Map([
 ["application/pdf","pdf"],["text/plain","txt"],
 ["text/csv","csv"],["application/zip","zip"],
]);
function fail(error:unknown){
 const status=error instanceof PublicPublisherError?error.status:503;
 return NextResponse.json({error:error instanceof PublicPublisherError?error.message:"Resource operation unavailable."},
  {status,headers:{"Cache-Control":"private, no-store"}});
}
export async function GET(){
 try{
  await requirePublicPublisher();
  const sql=publicAccessSql();
  const rows=await sql`select slug,title,summary,file_name,mime_type,byte_size,
    checksum_sha256,status,created_at,published_at,created_by,reviewed_by
    from public_access.resources order by created_at desc limit 100`;
  return NextResponse.json({resources:rows},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return fail(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
 try{
  const identity=await requirePublicPublisher();
  const input=await request.formData();
  const slug=String(input.get("slug")||"").trim();
  const title=String(input.get("title")||"").trim();
  const summary=String(input.get("summary")||"").trim();
  const file=input.get("file");
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)||title.length<5||title.length>160||
   summary.length<10||summary.length>1200||!(file instanceof File))
    return NextResponse.json({error:"Check resource details and file."},{status:400});
  const ext=types.get(file.type);
  const filename=file.name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,128);
  if(!ext||!filename.toLowerCase().endsWith("."+ext)||!(/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/).test(filename))
    return NextResponse.json({error:"Only PDF, text, CSV and ZIP files are supported."},{status:400});
  if(file.size<1||file.size>maxBytes)return NextResponse.json({error:"File size must be 1 byte to 2 MiB."},{status:413});
  const data=Buffer.from(await file.arrayBuffer());
  if(data.length!==file.size)return NextResponse.json({error:"Could not verify file size."},{status:400});
  if(file.type==="application/pdf"&&!data.subarray(0,5).equals(Buffer.from("%PDF-")))
    return NextResponse.json({error:"Invalid PDF header."},{status:400});
  if(file.type==="application/zip" && !(data[0]===0x50&&data[1]===0x4b))
    return NextResponse.json({error:"Invalid ZIP file header."},{status:400});
  if(file.type==="text/plain"||file.type==="text/csv"){
    const decoded=new TextDecoder("utf-8",{fatal:true}).decode(data);
    if(decoded.includes("\u0000"))return NextResponse.json({error:"Binary data is not allowed in text files."},{status:400});
    if(file.type==="text/csv"&&decoded.split("\n").some(line=>/^\s*[=+@-]/.test(line)))
      return NextResponse.json({error:"Potentially executable spreadsheet cells are not permitted."},{status:400});
  }
  const hash=createHash("sha256").update(data).digest("hex");
  const hex=data.toString("hex");
  const sql=publicAccessSql();
  const created=await sql`insert into public_access.resources(
   slug,title,summary,file_name,mime_type,data,byte_size,checksum_sha256,status,created_by
  ) values(${slug},${title},${summary},${filename},${file.type},
    decode(${hex},'hex'),${data.length},${hash},'DRAFT',${identity.userId})
   on conflict(slug) do nothing returning slug`;
  if(!created.length)return NextResponse.json({error:"Resource slug already exists."},{status:409});
  return NextResponse.json({slug,status:"DRAFT"},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(e){return fail(e);}
}
