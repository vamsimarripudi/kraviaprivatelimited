import {NextResponse} from "next/server";
import {z} from "zod";
import {officeMutationIsSameOrigin} from "@/lib/office/request-security";
import {OfficeChatPreferencesError,getOfficeChatPreferences,saveOfficeChatPreferences} from "@/lib/office/chat-preferences-server";
export const dynamic="force-dynamic";
const schema=z.object({notify_direct:z.boolean(),notify_mentions:z.boolean(),notify_ticket_updates:z.boolean(),
 email_digest_opt_in:z.boolean(),share_read_receipts:z.boolean(),reduce_motion:z.boolean()}).strict();
function fail(e:unknown){return NextResponse.json({detail:e instanceof OfficeChatPreferencesError?e.message:"Preferences unavailable"},
 {status:e instanceof OfficeChatPreferencesError?e.status:500,headers:{"Cache-Control":"no-store"}});}
export async function GET(){
 try{return NextResponse.json(await getOfficeChatPreferences(),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return fail(e);}
}
export async function PUT(request:Request){
 if(!officeMutationIsSameOrigin(request))return NextResponse.json({detail:"Origin not authorized"},
  {status:403,headers:{"Cache-Control":"no-store"}});
 const body=schema.safeParse(await request.json().catch(()=>null));
 if(!body.success)return NextResponse.json({detail:"Invalid settings"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{return NextResponse.json(await saveOfficeChatPreferences(body.data),
  {headers:{"Cache-Control":"no-store"}});}
 catch(e){return fail(e);}
}
