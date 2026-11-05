import { NextResponse } from "next/server";
import { currentPublicAccount } from "@/lib/public-access/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  const account=await currentPublicAccount();
  return NextResponse.json({account},{headers:{"Cache-Control":"private, no-store"}});
}
