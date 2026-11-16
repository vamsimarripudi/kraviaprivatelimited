import { NextResponse } from "next/server";
import { z } from "zod";
import { officeMutationIsSameOrigin } from "@/lib/office/request-security";
import {
  getCareersOfficeOverview,publishCareerJob,closeCareerPublication,
  importVerifiedCareerApplicant,scanCareerResume,
  recordCareerCommunicationConsent,decideCareerCommunicationConsent,reviewedOfferAcknowledgement,linkVerifiedCareerEmployee,
} from "@/lib/careers/office-server";
import { CareerError } from "@/lib/careers/server";
import { scanCareerCandidateDocument } from "@/lib/careers/documents-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=z.string().uuid();
const schema=z.discriminatedUnion("action",[
  z.object({
    action:z.literal("PUBLISH"),
    requisition_id:uuid,slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(4).max(100),
    title:z.string().trim().min(5).max(140),
    summary:z.string().trim().min(25).max(1000),
    description:z.string().trim().min(50).max(12000),
    requirements:z.string().trim().max(8000),
    benefits:z.string().trim().max(8000),
    expires_at:z.string().datetime({offset:true}).nullable().optional(),
  }),
  z.object({action:z.literal("PAUSE"),requisition_id:uuid}),
  z.object({action:z.literal("IMPORT_VERIFIED"),application_id:uuid}),
  z.object({action:z.literal("SCAN_RESUME"),application_id:uuid}),
  z.object({action:z.literal("RECORD_CONSENT"),application_id:uuid,reason:z.string().trim().min(12).max(500)}),
  z.object({action:z.literal("REVIEW_CONSENT"),candidate_id:uuid,approved:z.boolean(),reason:z.string().trim().min(12).max(500)}),
  z.object({action:z.literal("REVIEW_OFFER_ACK"),action_id:uuid}),
  z.object({action:z.literal("SCAN_CANDIDATE_DOCUMENT"),upload_id:uuid}),
  z.object({action:z.literal("LINK_VERIFIED_EMPLOYEE"),application_id:uuid,employee_user_id:uuid}),
]);
const headers={"Cache-Control":"private, no-store, max-age=0"};
function error(e:unknown) {
  return NextResponse.json({detail:e instanceof CareerError?e.message:"Recruitment action is unavailable"},{
    status:e instanceof CareerError?e.status:503,headers
  });
}
export async function GET() {
  try {return NextResponse.json(await getCareersOfficeOverview(),{headers});}
  catch(e){return error(e);}
}
export async function POST(request:Request) {
  if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Cross-origin mutation rejected"},{status:403,headers});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({detail:"Invalid authorized recruitment action"},{status:400,headers});
  try {
    const v=parsed.data;
    let result:unknown;
    switch(v.action) {
      case "PUBLISH": result=await publishCareerJob({
        requisitionId:v.requisition_id,slug:v.slug,title:v.title,summary:v.summary,
        description:v.description,requirements:v.requirements,benefits:v.benefits,
        expiresAt:v.expires_at
      });break;
      case "PAUSE":result=await closeCareerPublication(v.requisition_id);break;
      case "IMPORT_VERIFIED":result=await importVerifiedCareerApplicant(v.application_id);break;
      case "SCAN_RESUME":result=await scanCareerResume(v.application_id);break;
      case "RECORD_CONSENT":result=await recordCareerCommunicationConsent(v.application_id,v.reason);break;
      case "REVIEW_CONSENT":result=await decideCareerCommunicationConsent(v.candidate_id,v.approved,v.reason);break;
      case "REVIEW_OFFER_ACK":result=await reviewedOfferAcknowledgement(v.action_id);break;
      case "SCAN_CANDIDATE_DOCUMENT":result=await scanCareerCandidateDocument(v.upload_id);break;
      case "LINK_VERIFIED_EMPLOYEE":result=await linkVerifiedCareerEmployee(v.application_id,v.employee_user_id);break;
    }
    return NextResponse.json(result,{headers});
  }catch(e){return error(e);}
}
