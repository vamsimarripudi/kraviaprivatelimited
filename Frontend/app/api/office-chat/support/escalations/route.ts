import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {
 OfficeChatEscalationError,listOfficeChatEscalations,createOfficeChatEscalation,
 actionOfficeChatEscalation,
} from "@/lib/office/chat-escalation-server";
export const dynamic="force-dynamic";
const uuid=z.string().uuid();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE"),ticket_id:uuid,recipient_id:uuid,
  level:z.number().int().min(2).max(4),reason:z.string().trim().min(12).max(1000),request_nonce:uuid}).strict(),
 z.object({action:z.enum(["ACKNOWLEDGE","RESOLVE"]),escalation_id:uuid,note:z.string().trim().max(2000)}).strict(),
]);
function fail(e:unknown){return NextResponse.json({detail:e instanceof OfficeChatEscalationError?e.message:"Escalation unavailable"},
 {status:e instanceof OfficeChatEscalationError?e.status:500,headers:{"Cache-Control":"no-store"}});}
export async function GET(){
 try{return NextResponse.json(await listOfficeChatEscalations(),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return fail(e);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin operation denied"},
 {status:403,headers:{"Cache-Control":"no-store"}});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid escalation request"},
 {status:400,headers:{"Cache-Control":"no-store"}});
 try{
  const input=parsed.data;
  if(input.action==="CREATE")return NextResponse.json(await createOfficeChatEscalation({
    ticketId:input.ticket_id,recipientId:input.recipient_id,level:input.level,
    reason:input.reason,nonce:input.request_nonce
  }),{status:201,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json(await actionOfficeChatEscalation({
    id:input.escalation_id,action:input.action,note:input.note
  }),{headers:{"Cache-Control":"no-store"}});
 }catch(e){return fail(e);}
}
