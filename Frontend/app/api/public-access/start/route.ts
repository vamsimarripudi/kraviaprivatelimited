import { NextResponse } from "next/server";
import { z } from "zod";
import { publicQuotaIdentity } from "@/lib/corporate/public-quota";
import { PublicAccessError, sameOrigin, startAccess } from "@/lib/public-access/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema=z.object({
  email:z.email().max(254),
  displayName:z.string().trim().min(2).max(120).optional(),
  marketing:z.boolean().default(false),
  returnPath:z.string().max(240).optional(),
}).strict();
export async function POST(request:Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const input=inputSchema.safeParse(await request.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:"Please check the sign-in details."},{status:400});
  const quota=publicQuotaIdentity(request);
  if (!quota) return NextResponse.json({error:"This request cannot be verified right now."},{status:503});
  try {
    const challengeId=await startAccess({...input.data,returnPath:input.data.returnPath||"/resources",quotaIdentity:quota});
    return NextResponse.json({challengeId,expiresInMinutes:10},{
      status:201,headers:{"Cache-Control":"no-store"}
    });
  } catch(error) {
    const status=error instanceof PublicAccessError?error.status:503;
    return NextResponse.json({error:error instanceof PublicAccessError?error.message:"The service is temporarily unavailable."},
      {status,headers:{"Cache-Control":"no-store"}});
  }
}
