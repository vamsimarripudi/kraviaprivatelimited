import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCareerToken, CareerError } from "@/lib/careers/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({token:z.string().min(42).max(50)});
export async function POST(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin) return NextResponse.json({detail:"Origin is not authorized"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({detail:"Invalid verification link"},{status:400});
  try {
    const verified=await verifyCareerToken(parsed.data.token);
    const response=NextResponse.json({verified:true,reference:verified.reference},{
      headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}
    });
    response.cookies.set("kravia_careers_session",verified.sessionToken,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",
      path:"/",maxAge:7*24*60*60,priority:"high"
    });
    return response;
  } catch(e) {
    return NextResponse.json({detail:e instanceof CareerError?e.message:"Verification unavailable"},{
      status:e instanceof CareerError?e.status:503,headers:{"Cache-Control":"no-store"}
    });
  }
}
