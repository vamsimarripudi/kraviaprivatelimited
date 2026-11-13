import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {getOfficeDepartmentChannel,openOfficeDepartmentChannel,OfficeChatError} from "@/lib/office/chat-server";
export const dynamic="force-dynamic";
const schema=z.object({code:z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/)}).strict();
function failure(error:unknown){return NextResponse.json({
 detail:error instanceof OfficeChatError?error.message:"Channel unavailable"},
 {status:error instanceof OfficeChatError?error.status:500,headers:{"Cache-Control":"no-store"}});}
export async function GET(request:Request){
 const code=new URL(request.url).searchParams.get("code");
 const parsed=schema.safeParse({code});
 if(!parsed.success)return NextResponse.json({detail:"Channel unavailable"},
 {status:404,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await getOfficeDepartmentChannel(parsed.data.code),
  {headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin request forbidden"},
 {status:403,headers:{"Cache-Control":"no-store"}});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid channel"},
 {status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await openOfficeDepartmentChannel(parsed.data.code),
  {status:201,headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}
}
