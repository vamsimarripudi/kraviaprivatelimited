import {NextResponse} from "next/server";
import {z} from "zod";
import {publicAccessSql} from "@/lib/public-access/db";
import {PublicPublisherError,requirePublicPublisher} from "@/lib/public-access/publisher";
import {sameOrigin} from "@/lib/public-access/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Props={params:Promise<{slug:string}>};
const schema=z.object({action:z.enum(["PUBLISH","RETIRE"]),confirmed:z.literal(true)}).strict();
export async function POST(request:Request,{params}:Props){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"An explicit publication decision is required."},{status:400});
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))return NextResponse.json({error:"Invalid resource."},{status:400});
 try{
  const identity=await requirePublicPublisher();
  const sql=publicAccessSql();
  if(input.data.action==="PUBLISH"){
   const rows=await sql`update public_access.resources
    set status='PUBLISHED',reviewed_by=${identity.userId},published_at=now()
    where slug=${slug} and status in ('DRAFT','RETIRED') and byte_size>0 and data is not null
    returning slug,status`;
   if(!rows.length)return NextResponse.json({error:"The resource is not eligible for publication."},{status:409});
   return NextResponse.json({slug,status:"PUBLISHED"},{headers:{"Cache-Control":"no-store"}});
  }
  const rows=await sql`update public_access.resources set status='RETIRED',reviewed_by=${identity.userId}
   where slug=${slug} and status='PUBLISHED' returning slug`;
  if(!rows.length)return NextResponse.json({error:"Only published resources can be retired."},{status:409});
  return NextResponse.json({slug,status:"RETIRED"},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const status=e instanceof PublicPublisherError?e.status:503;
  return NextResponse.json({error:e instanceof PublicPublisherError?e.message:"Could not complete operation."},{status});
 }
}
