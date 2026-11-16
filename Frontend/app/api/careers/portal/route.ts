import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCareerPortal,submitCareerPortalAction,CareerError } from "@/lib/careers/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("WITHDRAWAL")}),
  z.object({action:z.literal("INTERVIEW_CONFIRMATION"),interview_id:z.string().uuid()}),
  z.object({action:z.literal("RESCHEDULE_REQUEST"),interview_id:z.string().uuid(),note:z.string().trim().min(12).max(1000)}),
  z.object({action:z.literal("OFFER_ACKNOWLEDGED"),offer_id:z.string().uuid(),typed_name:z.string().trim().min(2).max(220)}),
  z.object({action:z.literal("SIGN_OUT")}),
]);
const headers={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer"};
function error(e:unknown) {
  return NextResponse.json({detail:e instanceof CareerError?e.message:"Candidate portal is temporarily unavailable"},{
    status:e instanceof CareerError?e.status:503,headers
  });
}
export async function GET() {
  try {
    const session=(await cookies()).get("kravia_careers_session")?.value||"";
    return NextResponse.json(await getCareerPortal(session),{headers});
  } catch(e) {return error(e);}
}
export async function POST(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin) return NextResponse.json({detail:"Origin is not authorized"},{status:403,headers});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid candidate action"},{status:400,headers});
  if(parsed.data.action==="SIGN_OUT"){
    const response=NextResponse.json({ok:true},{headers});
    response.cookies.set("kravia_careers_session","",{path:"/",maxAge:0});
    return response;
  }
  try {
    const session=(await cookies()).get("kravia_careers_session")?.value||"";
    return NextResponse.json(await submitCareerPortalAction(session,parsed.data),{headers});
  } catch(e) {return error(e);}
}
