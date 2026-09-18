import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createContractObligation,
  getContractOperationsOverview,
  OfficeContractsError,
  reviewContractObligation,
  satisfyContractObligation,
} from "@/lib/office/contracts-server";

const schema=z.discriminatedUnion("action",[
  z.object({
    action:z.literal("CREATE_OBLIGATION"),
    contract_id:z.string().trim().min(1).max(120),
    obligation_type:z.enum(["PAYMENT","SLA","NOTICE","RENEWAL","SECURITY","PRIVACY","REPORTING","INSURANCE","DATA","DELIVERY","SUPPORT","OTHER"]),
    title:z.string().trim().min(3).max(220),
    description:z.string().trim().min(3).max(10000),
    owner_user_id:z.string().uuid(),
    cadence:z.enum(["ONCE","MONTHLY","QUARTERLY","ANNUAL","ONGOING"]),
    next_due_at:z.string().datetime({offset:true}).optional(),
    evidence_required:z.boolean(),
    source_clause_reference:z.string().trim().max(1200).optional(),
  }),
  z.object({action:z.literal("SATISFY_OBLIGATION"),obligation_id:z.string().uuid(),evidence:z.string().trim().max(1200).optional(),note:z.string().trim().max(3000).optional()}),
  z.object({action:z.literal("REVIEW_OBLIGATION"),obligation_id:z.string().uuid(),review_action:z.enum(["WAIVE","EXCEPTION","PAUSE","RESUME","CLOSE","CANCEL"]),evidence:z.string().trim().max(1200).optional(),note:z.string().trim().max(3000).optional()}),
]);

function failure(error:unknown){
  const status=error instanceof OfficeContractsError?error.status:500;
  const detail=error instanceof Error?error.message:"Contract operation failed";
  return NextResponse.json({detail},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){
  try{return NextResponse.json(await getContractOperationsOverview(),{headers:{"Cache-Control":"no-store"}})}
  catch(error){return failure(error)}
}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin contract mutation is not allowed"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid contract operation"},{status:400});
  try{
    const input=parsed.data;
    if(input.action==="CREATE_OBLIGATION")return NextResponse.json(await createContractObligation({
      contractId:input.contract_id,type:input.obligation_type,title:input.title,description:input.description,
      ownerUserId:input.owner_user_id,cadence:input.cadence,dueAt:input.next_due_at,evidenceRequired:input.evidence_required,
      clauseReference:input.source_clause_reference,
    }),{status:201});
    if(input.action==="SATISFY_OBLIGATION")return NextResponse.json(await satisfyContractObligation({obligationId:input.obligation_id,evidence:input.evidence,note:input.note}));
    return NextResponse.json(await reviewContractObligation({obligationId:input.obligation_id,action:input.review_action,evidence:input.evidence,note:input.note}));
  }catch(error){return failure(error)}
}
