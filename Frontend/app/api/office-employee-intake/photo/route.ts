import { NextResponse } from "next/server";
import { z } from "zod";
import { EmployeeIntakeError } from "@/lib/office/employee-intake-server";
import { readEmployeePhoto } from "@/lib/office/employee-intake-files";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const;
export async function GET(request:Request){
  const employee=new URL(request.url).searchParams.get("employee");
  if(employee&&!z.string().uuid().safeParse(employee).success)
    return NextResponse.json({detail:"Invalid employee"},{status:400,headers});
  try{
    const photo=await readEmployeePhoto(employee||undefined);
    if(!photo)return NextResponse.json({detail:"No verified photo uploaded"},{status:404,headers});
    return new NextResponse(photo.bytes,{headers:{...headers,"Content-Type":photo.mime,
      "Content-Disposition":"inline; filename=\"employee-photo\""}});
  }catch(error){return NextResponse.json({detail:error instanceof EmployeeIntakeError?error.message:"Private photo unavailable"},{
    status:error instanceof EmployeeIntakeError?error.status:500,headers,
  });}
}
