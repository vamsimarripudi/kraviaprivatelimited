import { NextResponse } from "next/server";
import { PUBLIC_SESSION_COOKIE, revokePublicSession, sameOrigin } from "@/lib/public-access/auth";
export const runtime="nodejs";
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});
  try{await revokePublicSession();}catch{return NextResponse.json({error:"Could not end this session."},{status:503});}
  const response=NextResponse.json({signedOut:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set({name:PUBLIC_SESSION_COOKIE,value:"",maxAge:0,httpOnly:true,
    secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/"});
  return response;
}
