import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {z} from "zod";
import {CareerError} from "@/lib/careers/server";
import {submitCareerCandidateDocument} from "@/lib/careers/documents-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=z.string().uuid();
export async function POST(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin)
    return NextResponse.json({detail:"Candidate upload origin rejected"},{status:403});
  const len=Number(request.headers.get("content-length")||0);
  if(!Number.isFinite(len)||len>5_242_880)
    return NextResponse.json({detail:"Document exceeds the secure 4 MB limit"},{status:413});
  try{
    const data=await request.formData();
    const parsed=uuid.safeParse(data.get("request_id"));
    const file=data.get("document");
    if(!parsed.success||!(file instanceof File))
      return NextResponse.json({detail:"A valid requested document is required"},{status:400});
    const session=(await cookies()).get("kravia_careers_session")?.value||"";
    return NextResponse.json(await submitCareerCandidateDocument(session,parsed.data,file),{
      headers:{"Cache-Control":"private, no-store"}
    });
  }catch(e){
    return NextResponse.json({detail:e instanceof CareerError?e.message:"Secure candidate upload unavailable"},{
      status:e instanceof CareerError?e.status:503,headers:{"Cache-Control":"private, no-store"}
    });
  }
}
