import { NextResponse } from "next/server";
import { z } from "zod";
import { submitCareerApplication, CareerError } from "@/lib/careers/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const form = z.object({
  job_slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
  full_name: z.string().trim().min(2).max(220),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(32).optional(),
  location: z.string().trim().max(250).optional(),
  note: z.string().trim().max(2500).optional(),
  privacy: z.literal("yes"),
  communication: z.enum(["yes","no"]).default("yes"),
  website: z.string().max(300).optional(),
});
function sameOrigin(request: Request) {
  const origin=request.headers.get("origin");
  return origin!==null && origin===new URL(request.url).origin;
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({detail:"Application origin is not authorized"},{status:403});
  const length=Number(request.headers.get("content-length")||0);
  if (!Number.isFinite(length)||length>5_242_880) return NextResponse.json({detail:"Application exceeds maximum size"},{status:413});
  try {
    const data=await request.formData();
    const parsed=form.safeParse(Object.fromEntries(
      ["job_slug","full_name","email","phone","location","note","privacy","communication","website"]
        .map(key=>[key,key==="communication"?(data.has(key)?"yes":"no"):String(data.get(key)||"")])
    ));
    if (!parsed.success) return NextResponse.json({detail:"Please check the application fields and privacy acknowledgement"},{status:400});
    const resume=data.get("resume");
    if (resume && !(resume instanceof File)) return NextResponse.json({detail:"Unsupported resume"},{status:400});
    const value=parsed.data;
    const result=await submitCareerApplication({
      jobSlug:value.job_slug,fullName:value.full_name,email:value.email,
      phone:value.phone,location:value.location,note:value.note,
      privacyAccepted:true,communicationRequested:value.communication==="yes",
      honeypot:value.website,resume:resume||null,
    },request);
    return NextResponse.json({accepted:result.accepted,reference:result.reference||null,message:"If eligible, a verification email has been requested. Check your inbox and spam folder."},{
      status:202,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}
    });
  } catch (e) {
    const status=e instanceof CareerError?e.status:503;
    return NextResponse.json({detail:e instanceof CareerError?e.message:"Application intake is temporarily unavailable"},{
      status,headers:{"Cache-Control":"no-store"}
    });
  }
}
