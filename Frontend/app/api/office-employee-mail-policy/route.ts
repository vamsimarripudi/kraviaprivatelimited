import { NextResponse } from "next/server";
import { z } from "zod";
import { OfficePermissionError, requireOfficeActor } from "@/lib/office/permission-engine";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const action = z.object({
  enabled:z.boolean(),
  reason:z.string().trim().min(12).max(500),
}).strict();

async function requireOwner() {
  const actor = await requireOfficeActor();
  if (!actor.identity.roles.includes("OWNER"))
    throw new OfficePermissionError(403,"Corporate Owner authority is required for mail delivery controls");
  return actor;
}
function failure(error:unknown) {
  const status=error instanceof OfficePermissionError?error.status:503;
  const detail=error instanceof OfficePermissionError?error.message:"Corporate mail delivery controls are unavailable";
  return NextResponse.json({detail},{status,headers});
}
async function readPolicy(actor:Awaited<ReturnType<typeof requireOwner>>) {
  const result=await actor.admin.from("office_employee_mail_delivery_policy")
    .select("enabled,approved_at,effective_from").eq("key","EMPLOYEE_ID_ISSUED").maybeSingle();
  if(result.error||!result.data) throw new Error("Employee mail policy has not been migrated or configured");
  return {
    kind:"EMPLOYEE_ID_ISSUED" as const,
    enabled:result.data.enabled===true,
    approved_at:result.data.approved_at||null,
    effective_from:result.data.effective_from||null,
    note:"Provider acceptance is not inbox delivery. No historical messages are dispatched. A separately configured Brevo-enabled Railway worker is required.",
  };
}

export async function GET() {
  try {return NextResponse.json(await readPolicy(await requireOwner()),{headers});}
  catch(error){return failure(error);}
}

export async function POST(request:Request) {
  if(!officeMutationIsSameOrigin(request))
    return NextResponse.json({detail:"Cross-origin company mail policy changes are prohibited"},{status:403,headers});
  const parsed=action.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)
    return NextResponse.json({detail:"Documented mail policy approval is required"},{status:400,headers});
  try {
    const actor=await requireOwner();
    const result=await actor.admin.rpc("office_employee_mail_policy_set",{
      p_actor:actor.identity.userId,
      p_enabled:parsed.data.enabled,
      p_effective_from:parsed.data.enabled?new Date().toISOString():null,
      p_reason:parsed.data.reason,
    });
    if(result.error||result.data!==true)
      return NextResponse.json({detail:"The independent mail policy approval was not recorded"},{status:409,headers});
    return NextResponse.json(await readPolicy(actor),{headers});
  } catch(error){return failure(error);}
}
