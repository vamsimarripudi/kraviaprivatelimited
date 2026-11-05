import { NextResponse } from "next/server";
import { z } from "zod";
import { completeAccess, PUBLIC_SESSION_COOKIE, PUBLIC_SESSION_SECONDS, PublicAccessError, sameOrigin, safePublicReturnPath } from "@/lib/public-access/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({challengeId:z.uuid(),code:z.string().regex(/^\d{6}$/),returnPath:z.string().max(240).optional()}).strict();
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const input=schema.safeParse(await request.json().catch(()=>null));
  if(!input.success)return NextResponse.json({error:"Check the verification code."},{status:400});
  try{
    const result=await completeAccess(input.data.challengeId,input.data.code);
    const response=NextResponse.json({
      verified:true,returnPath:safePublicReturnPath(input.data.returnPath),
      newsletterConfirmationPending:result.newsletter_pending
    },{headers:{"Cache-Control":"no-store"}});
    response.cookies.set({
      name:PUBLIC_SESSION_COOKIE,value:result.token,httpOnly:true,
      secure:process.env.NODE_ENV==="production",sameSite:"lax",
      path:"/",maxAge:PUBLIC_SESSION_SECONDS,
    });
    return response;
  }catch(error){
    const status=error instanceof PublicAccessError?error.status:503;
    return NextResponse.json({error:error instanceof PublicAccessError?error.message:"Verification is temporarily unavailable."},
      {status,headers:{"Cache-Control":"no-store"}});
  }
}
