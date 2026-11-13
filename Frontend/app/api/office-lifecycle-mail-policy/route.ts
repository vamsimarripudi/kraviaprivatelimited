import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const policyAction=z.object({
  event_code:z.string().regex(/^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-[0-9]{2}$/),
  enabled:z.boolean(),
  reason:z.string().trim().min(12).max(500),
}).strict();

async function owner(){
  const result=await requireOfficeActor();
  if(!result.identity.roles.includes("OWNER"))
    throw new OfficePermissionError(403,"Corporate Owner approval is required for lifecycle event policies");
  return result;
}
function failure(error:unknown){
  const status=error instanceof OfficePermissionError?error.status:503;
  return NextResponse.json({
    detail:error instanceof OfficePermissionError?error.message:"Lifecycle policy records are unavailable",
  },{status,headers});
}
async function readPolicies(actor:Awaited<ReturnType<typeof owner>>){
  const result=await actor.admin.from("office_lifecycle_mail_policy")
    .select("event_code,priority,source_ready,enabled,approved_at,effective_from,intent,subject,trigger_description,recipient_description")
    .order("event_code");
  if(result.error||!result.data||result.data.length!==81)
    throw new Error("Office lifecycle registry is incomplete or unavailable");
  const states=["PENDING","SENDING","SENT","REJECTED","UNKNOWN"] as const;
  const counts=await Promise.all(states.map(status=>actor.admin.from("office_lifecycle_mail_outbox")
    .select("id",{count:"exact",head:true}).eq("status",status)));
  return {
    policies:result.data,
    total:81,
    source_ready:result.data.filter(row=>row.source_ready===true).length,
    enabled:result.data.filter(row=>row.enabled===true).length,
    count_by_status:Object.fromEntries(states.map((status,i)=>[status,
      !counts[i]?.error && typeof counts[i]?.count==="number"?counts[i].count:null])),
    notice:"Only committed, source-verified employee events can be enabled. All 81 copies exist but unmapped event sources remain blocked. Provider acceptance does not prove inbox delivery.",
  };
}
export async function GET(){
  try{return NextResponse.json(await readPolicies(await owner()),{headers});}
  catch(error){return failure(error);}
}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))
    return NextResponse.json({detail:"Cross-origin lifecycle-policy mutation prohibited"},{status:403,headers});
  const parsed=policyAction.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)
    return NextResponse.json({detail:"Invalid documented lifecycle-policy decision"},{status:400,headers});
  try{
    const current=await owner();
    const result=await current.admin.rpc("office_lifecycle_mail_policy_set",{
      p_actor:current.identity.userId,
      p_event:parsed.data.event_code,
      p_enabled:parsed.data.enabled,
      p_effective_from:parsed.data.enabled?new Date().toISOString():null,
      p_reason:parsed.data.reason,
    });
    if(result.error||result.data!==true)
      return NextResponse.json({detail:"Independent lifecycle event approval was not recorded"},{status:409,headers});
    return NextResponse.json(await readPolicies(current),{headers});
  }catch(error){return failure(error);}
}
