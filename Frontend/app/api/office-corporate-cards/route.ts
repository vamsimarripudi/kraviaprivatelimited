import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  createCorporateCard,
  getCorporateCardOverview,
  markCorporateCardSpendUsed,
  OfficeCorporateCardError,
  requestCorporateCardSpend,
  reviewCorporateCard,
  reviewCorporateCardSpend,
} from "@/lib/office/corporate-card-server";

const uuid=z.string().uuid();const opt=(n:number)=>z.string().trim().max(n).optional();
const categories=z.array(z.string().trim().min(1).max(120)).max(100);
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE_CARD"),issuer:z.string().trim().min(2).max(180),account_reference:opt(500),card_reference:opt(500),last4:z.string().regex(/^[0-9]{4}$/),card_type:z.enum(["PHYSICAL","VIRTUAL"]),holder_user_id:uuid,department:opt(120),cost_center:opt(120),currency:z.string().trim().length(3),per_transaction_limit_minor:z.number().int().min(0).optional(),monthly_limit_minor:z.number().int().min(0).optional(),allowed_merchant_categories:categories,online_allowed:z.boolean(),international_allowed:z.boolean(),atm_allowed:z.boolean(),valid_through_month:z.number().int().min(1).max(12).optional(),valid_through_year:z.number().int().min(2020).max(2200).optional()}),
 z.object({action:z.literal("REVIEW_CARD"),card_id:uuid,status:z.enum(["ACTIVE","FROZEN","REISSUE_PENDING","CLOSED"]),per_transaction_limit_minor:z.number().int().min(0).optional(),monthly_limit_minor:z.number().int().min(0).optional(),allowed_merchant_categories:categories,online_allowed:z.boolean(),international_allowed:z.boolean(),atm_allowed:z.boolean(),note:opt(3000)}),
 z.object({action:z.literal("REQUEST_SPEND"),card_id:uuid,purpose:z.string().trim().min(3).max(500),merchant_category:opt(120),amount_minor:z.number().int().positive(),currency:z.string().trim().length(3),project_reference:opt(500),expense_reference:opt(500),needed_by:z.string().datetime({offset:true}).optional()}),
 z.object({action:z.literal("REVIEW_SPEND"),request_id:uuid,status:z.enum(["APPROVED","REJECTED"]),note:opt(3000)}),
 z.object({action:z.literal("MARK_USED"),request_id:uuid,transaction_reference:z.string().trim().min(3).max(1200),receipt_reference:z.string().trim().min(3).max(1200)}),
]);
function failure(error:unknown){
 const status=error instanceof OfficeCorporateCardError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Corporate-card operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getCorporateCardOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin corporate-card mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid corporate-card operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE_CARD")return NextResponse.json(await createCorporateCard({issuer:i.issuer,accountReference:i.account_reference,cardReference:i.card_reference,last4:i.last4,type:i.card_type,holderUserId:i.holder_user_id,department:i.department,costCenter:i.cost_center,currency:i.currency,perTransactionLimitMinor:i.per_transaction_limit_minor,monthlyLimitMinor:i.monthly_limit_minor,categories:i.allowed_merchant_categories,onlineAllowed:i.online_allowed,internationalAllowed:i.international_allowed,atmAllowed:i.atm_allowed,validMonth:i.valid_through_month,validYear:i.valid_through_year}),{status:201});
  if(i.action==="REVIEW_CARD")return NextResponse.json(await reviewCorporateCard({cardId:i.card_id,status:i.status,perTransactionLimitMinor:i.per_transaction_limit_minor,monthlyLimitMinor:i.monthly_limit_minor,categories:i.allowed_merchant_categories,onlineAllowed:i.online_allowed,internationalAllowed:i.international_allowed,atmAllowed:i.atm_allowed,note:i.note}));
  if(i.action==="REQUEST_SPEND")return NextResponse.json(await requestCorporateCardSpend({cardId:i.card_id,purpose:i.purpose,category:i.merchant_category,amountMinor:i.amount_minor,currency:i.currency,projectReference:i.project_reference,expenseReference:i.expense_reference,neededBy:i.needed_by}),{status:201});
  if(i.action==="REVIEW_SPEND")return NextResponse.json(await reviewCorporateCardSpend({requestId:i.request_id,status:i.status,note:i.note}));
  return NextResponse.json(await markCorporateCardSpendUsed({requestId:i.request_id,transactionReference:i.transaction_reference,receiptReference:i.receipt_reference}));
 }catch(error){return failure(error)}
}
