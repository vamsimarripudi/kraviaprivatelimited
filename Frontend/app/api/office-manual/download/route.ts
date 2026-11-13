import { getOfficeManualHub, OfficeManualError } from "@/lib/office/manual-server";
import { renderOfficeManualPdf } from "@/lib/office/manual-pdf";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Self-only: the server resolves the active employee's role and permissions. */
export async function GET(){
  try{
    const hub=await getOfficeManualHub();
    const pdf=renderOfficeManualPdf({
      edition:hub.edition,common:hub.common,roles:hub.roles,routes:hub.routes,
    });
    return new Response(pdf,{
      status:200,headers:{
        "Content-Type":"application/pdf",
        "Content-Disposition":'attachment; filename="KRAVIA-Office-My-User-Manual.pdf"',
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff",
      },
    });
  }catch(error){
    const status=error instanceof OfficeManualError?error.status:500;
    return Response.json({detail:status===500?"PDF manual unavailable":(error as OfficeManualError).message},
      {status,headers:{"Cache-Control":"private, no-store"}});
  }
}
