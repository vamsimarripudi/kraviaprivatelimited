import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  bookTravel,
  createTravelRequest,
  financeReviewTravel,
  getTravelWorkspace,
  managerReviewTravel,
  OfficeTravelError,
  reviewTravelClaim,
  submitTravelClaim,
  transitionOwnTravel,
} from "@/lib/office/travel-server";

const uuid=z.string().uuid();
const note=z.string().trim().max(2000).optional();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("CREATE_TRAVEL"),purpose:z.string().trim().min(3).max(4000),destination:z.string().trim().min(2).max(300),starts_on:z.string().date(),ends_on:z.string().date(),estimate_paise:z.number().int().min(0).max(9007199254740991),currency:z.string().trim().length(3),project_reference:z.string().trim().max(500).optional(),cost_center:z.string().trim().max(120).optional()}),
  z.object({action:z.literal("MANAGER_REVIEW"),travel_id:uuid,decision:z.enum(["APPROVED","REJECTED"]),note}),
  z.object({action:z.literal("FINANCE_REVIEW"),travel_id:uuid,decision:z.enum(["APPROVED","REJECTED"]),note}),
  z.object({action:z.literal("BOOK"),travel_id:uuid,reference:z.string().trim().min(3).max(1000),evidence:z.string().trim().min(3).max(2000)}),
  z.object({action:z.literal("SELF_TRANSITION"),travel_id:uuid,status:z.enum(["IN_TRIP","COMPLETED","CANCELLED"])}),
  z.object({action:z.literal("SUBMIT_CLAIM"),travel_id:uuid,expense_date:z.string().date(),category:z.enum(["TRANSPORT","LODGING","MEALS","LOCAL_TRAVEL","VISA","COMMUNICATION","OTHER"]),description:z.string().trim().min(3).max(4000),amount_paise:z.number().int().min(1).max(9007199254740991),currency:z.string().trim().length(3),receipt_reference:z.string().trim().min(3).max(2000)}),
  z.object({action:z.literal("REVIEW_CLAIM"),claim_id:uuid,status:z.enum(["APPROVED","REJECTED","PAID"]),note,payment_reference:z.string().trim().max(1200).optional()}),
]);

function failure(error:unknown){
  const status=error instanceof OfficeTravelError?error.status:500;
  return NextResponse.json({detail:error instanceof Error?error.message:"Travel request failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){
  try{return NextResponse.json(await getTravelWorkspace(),{headers:{"Cache-Control":"no-store"}})}
  catch(error){return failure(error)}
}
export async function POST(request:Request){
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin travel mutation is not allowed"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid travel request"},{status:400});
  try{
    const i=parsed.data;
    if(i.action==="CREATE_TRAVEL")return NextResponse.json(await createTravelRequest({purpose:i.purpose,destination:i.destination,startsOn:i.starts_on,endsOn:i.ends_on,estimatePaise:i.estimate_paise,currency:i.currency,projectReference:i.project_reference,costCenter:i.cost_center}),{status:201});
    if(i.action==="MANAGER_REVIEW")return NextResponse.json(await managerReviewTravel({travelId:i.travel_id,decision:i.decision,note:i.note}));
    if(i.action==="FINANCE_REVIEW")return NextResponse.json(await financeReviewTravel({travelId:i.travel_id,decision:i.decision,note:i.note}));
    if(i.action==="BOOK")return NextResponse.json(await bookTravel({travelId:i.travel_id,reference:i.reference,evidence:i.evidence}));
    if(i.action==="SELF_TRANSITION")return NextResponse.json(await transitionOwnTravel({travelId:i.travel_id,status:i.status}));
    if(i.action==="SUBMIT_CLAIM")return NextResponse.json(await submitTravelClaim({travelId:i.travel_id,expenseDate:i.expense_date,category:i.category,description:i.description,amountPaise:i.amount_paise,currency:i.currency,receiptReference:i.receipt_reference}),{status:201});
    return NextResponse.json(await reviewTravelClaim({claimId:i.claim_id,status:i.status,note:i.note,paymentReference:i.payment_reference}));
  }catch(error){return failure(error)}
}
