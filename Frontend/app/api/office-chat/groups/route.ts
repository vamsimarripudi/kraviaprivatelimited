import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { createOfficeChatGroup, OfficeChatError } from "@/lib/office/chat-server";
const schema=z.object({
 title:z.string().trim().min(3).max(120),
 members:z.array(z.string().uuid()).min(1).max(29).refine(list=>new Set(list).size===list.length,"Distinct members required"),
}).strict();
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin operation is forbidden"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid group or membership"},{status:400});
 try{return NextResponse.json(await createOfficeChatGroup(parsed.data.title,parsed.data.members),
   {status:201,headers:{"Cache-Control":"no-store"}});}
 catch(error){return NextResponse.json({detail:error instanceof OfficeChatError?error.message:"Group creation failed"},
  {status:error instanceof OfficeChatError?error.status:500,headers:{"Cache-Control":"no-store"}});}
}
