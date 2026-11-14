import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {getOfficeVaultVerificationQueue,reviewOfficeVaultRegistration,
 OfficeVaultVerificationError} from "@/lib/office/vault-verification-server";
import {OfficeVaultAccessError} from "@/lib/office/vault-access-server";
import {OfficeRegistrationError} from "@/lib/office/registration-server";
export const dynamic="force-dynamic";
const schema=z.object({record_id:z.string().uuid(),decision:z.enum(["ACTIVE","REJECTED"]),
 note:z.string().trim().min(10).max(2000),evidence_reference:z.string().trim().max(1200).optional()}).strict();
function errorResponse(error:unknown){
 const status=error instanceof OfficeVaultVerificationError||error instanceof OfficeVaultAccessError||
  error instanceof OfficeRegistrationError?error.status:500;
 return NextResponse.json({detail:status===500?"Verification source is unavailable":
  error instanceof Error?error.message:"Source unavailable"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){
 try{return NextResponse.json(await getOfficeVaultVerificationQueue(),
  {headers:{"Cache-Control":"no-store"}});}
 catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Origin not authorized"},
  {status:403,headers:{"Cache-Control":"no-store"}});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({detail:"Invalid evidence review"},
  {status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await reviewOfficeVaultRegistration({
  recordId:parsed.data.record_id,decision:parsed.data.decision,note:parsed.data.note,
  evidenceReference:parsed.data.evidence_reference,
 }),{headers:{"Cache-Control":"no-store"}});}
 catch(error){return errorResponse(error);}
}
