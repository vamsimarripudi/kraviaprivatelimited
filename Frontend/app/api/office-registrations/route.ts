import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import { createOfficeRegistration, getOfficeRegistrationOverview, OfficeRegistrationError, reviewOfficeRegistration, updateOfficeRegistration } from "@/lib/office/registration-server";

const uuid=z.string().uuid();
const optDate=z.string().date().optional();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE"),registration_type:z.string().trim().min(2).max(100),title:z.string().trim().min(2).max(220),authority:z.string().trim().min(2).max(220),jurisdiction:z.string().trim().min(2).max(80).default("IN"),identifier_suffix:z.string().trim().min(2).max(20),issued_on:optDate,expires_on:optDate,renewal_due_on:optDate,source_reference:z.string().trim().min(3).max(1200),evidence_reference:z.string().trim().max(1200).optional(),owner_user_id:uuid.optional()}),
 z.object({action:z.literal("REVIEW"),registration_id:uuid,status:z.enum(["ACTIVE","REJECTED"]),note:z.string().trim().max(2000).optional(),evidence_reference:z.string().trim().max(1200).optional()}),
 z.object({action:z.literal("UPDATE"),registration_id:uuid,expires_on:optDate,renewal_due_on:optDate,status:z.enum(["ACTIVE","RENEWAL_DUE","EXPIRED","SUPERSEDED","CANCELLED"]),source_reference:z.string().trim().max(1200).optional(),evidence_reference:z.string().trim().max(1200).optional(),owner_user_id:uuid.optional(),note:z.string().trim().max(2000).optional()}),
]);

function failure(error:unknown){
 const status=error instanceof OfficeRegistrationError?error.status:500;
 return NextResponse.json({detail:error instanceof Error?error.message:"Registration operation failed"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){try{return NextResponse.json(await getOfficeRegistrationOverview(),{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error)}}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin registration mutation is not allowed"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid registration operation"},{status:400});
 try{
  const i=parsed.data;
  if(i.action==="CREATE")return NextResponse.json(await createOfficeRegistration({type:i.registration_type,title:i.title,authority:i.authority,jurisdiction:i.jurisdiction,identifierSuffix:i.identifier_suffix,issuedOn:i.issued_on,expiresOn:i.expires_on,renewalDueOn:i.renewal_due_on,sourceReference:i.source_reference,evidenceReference:i.evidence_reference,ownerUserId:i.owner_user_id}),{status:201});
  if(i.action==="REVIEW")return NextResponse.json(await reviewOfficeRegistration({registrationId:i.registration_id,status:i.status,note:i.note,evidenceReference:i.evidence_reference}));
  return NextResponse.json(await updateOfficeRegistration({registrationId:i.registration_id,expiresOn:i.expires_on,renewalDueOn:i.renewal_due_on,status:i.status,sourceReference:i.source_reference,evidenceReference:i.evidence_reference,ownerUserId:i.owner_user_id,note:i.note}));
 }catch(error){return failure(error)}
}
