import { NextResponse } from "next/server";
import { z } from "zod";
import { getOfficeManualHub,recordOfficeManual,OfficeManualError } from "@/lib/office/manual-server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const noStore={"Cache-Control":"private, no-store"} as const;
const mutation=z.object({
  action:z.enum(["OPEN","ACKNOWLEDGE"]),
  key:z.string().trim().max(90).regex(/^(COMMON|ROLE:[A-Z0-9-]{3,80})$/),
}).strict();

function failure(error:unknown){
  const status=error instanceof OfficeManualError?error.status
    :error instanceof Error&&error.name==="OfficePermissionError"?(Number((error as {status?:number}).status)||401)
    :500;
  const detail=error instanceof OfficeManualError?error.message:
    status===401||status===403?"Authorised Office session required":"Manual service unavailable";
  return NextResponse.json({detail},{status,headers:noStore});
}
export async function GET(){
  try{return NextResponse.json(await getOfficeManualHub(),{headers:noStore});}
  catch(error){return failure(error);}
}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))
    return NextResponse.json({detail:"Cross-origin manual update rejected"},{status:403,headers:noStore});
  const parsed=mutation.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)
    return NextResponse.json({detail:"Invalid manual reading action"},{status:400,headers:noStore});
  try{return NextResponse.json(await recordOfficeManual(parsed.data),{headers:noStore});}
  catch(error){return failure(error);}
}
