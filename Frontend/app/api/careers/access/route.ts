import { NextResponse } from "next/server";
import { z } from "zod";
import { requestCareerLogin, CareerError } from "@/lib/careers/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const bodySchema=z.object({email:z.string().email().max(320),reference:z.string().trim().min(6).max(40)});
export async function POST(request:Request) {
  if (request.headers.get("origin")!==new URL(request.url).origin) return NextResponse.json({detail:"Origin is not authorized"},{status:403});
  const parsed=bodySchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({detail:"Enter a valid email and application reference"},{status:400});
  try {
    await requestCareerLogin(parsed.data.email,parsed.data.reference,request);
    return NextResponse.json({accepted:true,message:"If the application is eligible, an access link will be sent."},{status:202,headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    return NextResponse.json({detail:e instanceof CareerError?e.message:"Application access is unavailable"},{
      status:e instanceof CareerError?e.status:503,headers:{"Cache-Control":"no-store"}
    });
  }
}
