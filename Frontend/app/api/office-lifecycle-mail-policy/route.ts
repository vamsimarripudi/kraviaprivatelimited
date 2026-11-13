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
    .select("event_code,priority,source_ready,delivery_owner,enabled,approved_at,effective_from,intent,subject,trigger_description,recipient_description")
    .order("event_code");
  if(result.error||!result.data||result.data.length!==81)
    throw new Error("Office lifecycle registry is incomplete or unavailable");
  const states=["PENDING","SENDING","SENT","REJECTED","UNKNOWN","SKIPPED"] as const;
  const sources={
    internal:"office_lifecycle_mail_outbox",
    candidate:"office_candidate_mail_outbox",
    external:"office_external_notice_outbox",
  } as const;
  const results=await Promise.all(Object.entries(sources).map(async ([label,table])=>[
    label,
    await Promise.all(states.map(status=>actor.admin.from(table)
      .select("id",{count:"exact",head:true}).eq("status",status))),
  ] as const));
  const counts_by_source=Object.fromEntries(results.map(([label,values])=>[
    label,Object.fromEntries(states.map((status,i)=>[
      status,!values[i]?.error&&typeof values[i]?.count==="number"?values[i].count:null,
    ])),
  ]));
  return {
    policies:result.data,
    total:81,
    source_ready:result.data.filter(row=>row.source_ready===true).length,
    enabled:result.data.filter(row=>row.enabled===true).length,
    count_by_status:counts_by_source.internal,
    counts_by_source,
    notice:"Covered source pathways are not activated emails. Credential notifications remain owned by first-party authentication; external candidate and former-employee/signing notices have separate consent and worker gates. Provider acceptance never proves inbox delivery.",
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
    const ownership=await current.admin.from("office_lifecycle_mail_policy")
      .select("delivery_owner").eq("event_code",parsed.data.event_code).single();
    if(ownership.error||!ownership.data)
      return NextResponse.json({detail:"The lifecycle delivery owner could not be verified"},{status:503,headers});
    if(parsed.data.enabled&&ownership.data.delivery_owner==="FIRST_PARTY_AUTH")
      return NextResponse.json({detail:"This security email is already delivered by the authenticated Office workflow; enabling lifecycle delivery would duplicate it"},{status:409,headers});
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
