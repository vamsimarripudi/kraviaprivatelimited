import {NextResponse} from "next/server";
import {z} from "zod";
import {requireOfficeActor,OfficePermissionError} from "@/lib/office/permission-engine";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("SAVE"),title:z.string().trim().min(1).max(60),
  body:z.string().trim().min(1).max(4000)}).strict(),
 z.object({action:z.literal("DELETE"),id:z.string().uuid()}).strict()
]);
async function actor(){
 const current=await requireOfficeActor();
 if(current.identity.workspaceStatus!=="ACTIVE")
  throw new OfficePermissionError(403,"An active Office membership is required");
 return current;
}
function errorResponse(error:unknown){
 const status=error instanceof OfficePermissionError?error.status:503;
 return NextResponse.json({detail:status===401?"Office sign-in required":status===403?
  "Private templates require an active verified Office identity":"Private template service unavailable"},
  {status,headers});
}
export async function GET(){
 try{
  const current=await actor();
  const {data,error}=await current.admin.from("office_chat_personal_templates")
   .select("id,title,body,updated_at").eq("owner_user_id",current.identity.userId)
   .order("updated_at",{ascending:false}).limit(12);
  if(error)throw new Error("Template store unavailable");
  return NextResponse.json({templates:data??[]},{headers});
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))
  return NextResponse.json({detail:"Cross-origin template writes prohibited"},{status:403,headers});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)
  return NextResponse.json({detail:"Invalid template action"},{status:400,headers});
 try{
  const current=await actor(),input=parsed.data;
  if(input.action==="DELETE"){
   const {data,error}=await current.admin.from("office_chat_personal_templates")
    .delete().eq("owner_user_id",current.identity.userId).eq("id",input.id)
    .select("id").maybeSingle();
   if(error)throw new Error("Template deletion unavailable");
   if(!data)return NextResponse.json({detail:"Template not found"},{status:404,headers});
   return NextResponse.json({deleted:true},{headers});
  }
  const existing=await current.admin.from("office_chat_personal_templates")
   .select("title").eq("owner_user_id",current.identity.userId).limit(13);
  if(existing.error)throw new Error("Template quota unavailable");
  if((existing.data??[]).length>=12&&!existing.data?.some(item=>item.title===input.title))
   return NextResponse.json({detail:"Maximum of 12 personal templates"},{status:409,headers});
  const {data,error}=await current.admin.from("office_chat_personal_templates").upsert({
   owner_user_id:current.identity.userId,title:input.title,body:input.body,
   updated_at:new Date().toISOString()
  },{onConflict:"owner_user_id,title"}).select("id,title,body,updated_at").single();
  if(error||!data)throw new Error("Template write unavailable");
  return NextResponse.json({template:data},{status:201,headers});
 }catch(error){return errorResponse(error);}
}
