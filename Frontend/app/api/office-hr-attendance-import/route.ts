import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  HrImportError,previewHrAttendanceFile,stageHrAttendanceFile,
  readHrAttendanceImports,reviewHrAttendanceRow,
} from "@/lib/office/hr-attendance-import-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
const reviewSchema=z.object({
  action:z.literal("REVIEW_ROW"),rowId:z.string().uuid(),
  decision:z.enum(["ACCEPT","REJECT"]),note:z.string().trim().min(12).max(1000),
});
function errorResponse(err:unknown){
  const status=err instanceof HrImportError?err.status:500;
  return NextResponse.json({detail:err instanceof HrImportError?err.message:"HR attendance import unavailable"},
    {status,headers});
}
export async function GET(request:Request){
  const id=new URL(request.url).searchParams.get("batch");
  if(id&&!z.string().uuid().safeParse(id).success)
    return NextResponse.json({detail:"Invalid HR batch identifier"},{status:400,headers});
  try{return NextResponse.json(await readHrAttendanceImports(id||undefined),{headers});}
  catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))
    return NextResponse.json({detail:"Cross-origin HR data import is prohibited"},{status:403,headers});
  const declared=Number(request.headers.get("content-length")||0);
  if(!Number.isFinite(declared)||declared>2_400_000)
    return NextResponse.json({detail:"Workbook upload exceeds 2 MiB limit"},{status:413,headers});
  const kind=request.headers.get("content-type")||"";
  if(kind.startsWith("application/json")){
    const parsed=reviewSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success)return NextResponse.json({detail:"Invalid review request"},{status:400,headers});
    try{return NextResponse.json(await reviewHrAttendanceRow({
      rowId:parsed.data.rowId,decision:parsed.data.decision,note:parsed.data.note
    }),{headers});}
    catch(error){return errorResponse(error);}
  }
  if(!kind.startsWith("multipart/form-data"))
    return NextResponse.json({detail:"Send an .xlsx Excel workbook"},{status:415,headers});
  const form=await request.formData().catch(()=>null);
  const file=form?.get("file"),action=form?.get("action");
  if(!(file instanceof File)||(action!=="PREVIEW"&&action!=="STAGE"))
    return NextResponse.json({detail:"Choose Preview or Stage and attach a KRAVIA Excel workbook"},{status:400,headers});
  try {
    const result=action==="PREVIEW" ? await previewHrAttendanceFile(file):await stageHrAttendanceFile(file);
    return NextResponse.json(result,{status:action==="STAGE"?201:200,headers});
  }catch(error){return errorResponse(error);}
}
