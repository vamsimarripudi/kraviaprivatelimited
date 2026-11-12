import { NextResponse } from "next/server";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { uploadEmployeeIntakeFile } from "@/lib/office/employee-intake-files";
import { EmployeeIntakeError } from "@/lib/office/employee-intake-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"} as const;
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))
    return NextResponse.json({detail:"Cross-origin employee evidence upload prohibited"},{status:403,headers});
  const declared=Number(request.headers.get("content-length")||0);
  if(declared>11_500_000)return NextResponse.json({detail:"File is too large"},{status:413,headers});
  const form=await request.formData().catch(()=>null);
  const file=form?.get("file");
  const kind=form?.get("kind");
  const label=form?.get("label");
  if(!(file instanceof File)||(kind!=="PHOTO"&&kind!=="CERTIFICATE")||
    (typeof label!=="string"&&label!==null)||String(label||"").length>140)
    return NextResponse.json({detail:"Invalid employee evidence upload"},{status:400,headers});
  try{
    return NextResponse.json(await uploadEmployeeIntakeFile({
      file,kind,label:typeof label==="string"?label:undefined,
    }),{status:201,headers});
  }catch(error){
    return NextResponse.json({detail:error instanceof EmployeeIntakeError?error.message:"Private upload unavailable"},{
      status:error instanceof EmployeeIntakeError?error.status:500,headers,
    });
  }
}
