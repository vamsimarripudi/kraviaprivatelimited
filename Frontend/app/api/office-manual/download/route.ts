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
      fullCommon:hub.full_documents.COMMON,
      fullRoles:hub.roles.map(role=>hub.full_documents["ROLE:"+role.id.toUpperCase()]??""),
    });
    const body = new Uint8Array(pdf.byteLength);
    body.set(pdf);
    return new Response(body.buffer,{
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
