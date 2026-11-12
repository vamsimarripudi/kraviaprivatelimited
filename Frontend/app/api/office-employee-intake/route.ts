import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  EmployeeIntakeError, employeeIntakeOverview, employeeIntakeDirectory, saveEmployeeIntake,
  submitEmployeeIntake, reviewEmployeeIntake, verifyEmployeeBank, issuePermanentEmployeeId,
} from "@/lib/office/employee-intake-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const reason = z.string().trim().min(12).max(1000);
const noCache = { "Cache-Control": "private, no-store" } as const;
const address = z.object({
  street: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(24).optional(),
  country: z.string().trim().max(90).optional(),
}).strict();
const education = z.array(z.object({
  qualification: z.string().trim().min(2).max(160),
  institution: z.string().trim().min(2).max(180),
  year: z.number().int().min(1950).max(2100).optional(),
  course: z.string().trim().max(180).optional(),
}).strict()).max(24);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SAVE"),
    legal_name: z.string().trim().min(2).max(160),
    preferred_name: z.string().trim().max(120).optional(),
    contact_phone: z.string().trim().min(6).max(32),
    date_of_birth: z.string().date().optional(),
    current_address: address,
    education,
    bank_account: z.string().trim().min(8).max(28).optional(),
    bank_account_holder: z.string().trim().max(160).optional(),
    bank_ifsc: z.string().trim().max(11).optional(),
    signature_evidence_reference: z.string().trim().max(450).optional(),
    policy_acknowledged: z.boolean(),
  }).strict(),
  z.object({action:z.literal("SUBMIT")}).strict(),
  z.object({action:z.literal("REVIEW"),employee_id:uuid,decision:z.enum(["VERIFY","RETURN"]),reason}).strict(),
  z.object({action:z.literal("VERIFY_BANK"),employee_id:uuid,evidence_reference:z.string().trim().min(8).max(400),reason}).strict(),
  z.object({action:z.literal("ISSUE_ID"),employee_id:uuid,reason}).strict(),
]);

function failure(error: unknown) {
  const status = error instanceof EmployeeIntakeError ? error.status : 500;
  return NextResponse.json({detail:error instanceof EmployeeIntakeError ? error.message :
    "Verified employee onboarding is temporarily unavailable"},{status,headers:noCache});
}
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if(params.get("directory")==="1"){
    try{return NextResponse.json(await employeeIntakeDirectory(),{headers:noCache});}
    catch(error){return failure(error);}
  }
  const employee = params.get("employee");
  if (employee && !uuid.safeParse(employee).success)
    return NextResponse.json({detail:"Invalid employee identifier"},{status:400,headers:noCache});
  try {
    return NextResponse.json(await employeeIntakeOverview(employee||undefined),{headers:noCache});
  } catch(error){return failure(error);}
}

export async function POST(request: Request) {
  if (!officeMutationIsSameOrigin(request))
    return NextResponse.json({detail:"Cross-origin HR mutation prohibited"},{status:403,headers:noCache});
  const parsed = schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success)
    return NextResponse.json({detail:"Invalid private employee intake request"},{status:400,headers:noCache});
  try {
    const input = parsed.data;
    const result = input.action==="SAVE" ? await saveEmployeeIntake(input)
      : input.action==="SUBMIT" ? await submitEmployeeIntake()
      : input.action==="REVIEW" ? await reviewEmployeeIntake({employeeId:input.employee_id,decision:input.decision,reason:input.reason})
      : input.action==="VERIFY_BANK" ? await verifyEmployeeBank({employeeId:input.employee_id,evidenceReference:input.evidence_reference,reason:input.reason})
      : await issuePermanentEmployeeId({employeeId:input.employee_id,reason:input.reason});
    return NextResponse.json(result,{headers:noCache});
  } catch(error){return failure(error);}
}
