import "server-only";
import {OfficePermissionError,requireOfficeActor} from "@/lib/office/permission-engine";
export class OfficeChatPreferencesError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name="OfficeChatPreferencesError";}
}
async function actor(){
 try{const current=await requireOfficeActor();
  if(current.identity.workspaceStatus!=="ACTIVE")throw new OfficeChatPreferencesError(403,"Active Office access required");
  return current;
 }catch(e){if(e instanceof OfficePermissionError)throw new OfficeChatPreferencesError(e.status,e.message);throw e;}
}
export type ConnectPrefs={notify_direct:boolean;notify_mentions:boolean;notify_ticket_updates:boolean;
 email_digest_opt_in:boolean;share_read_receipts:boolean;reduce_motion:boolean};
export const defaults:Readonly<ConnectPrefs>={notify_direct:true,notify_mentions:true,notify_ticket_updates:true,
 email_digest_opt_in:false,share_read_receipts:false,reduce_motion:false};
export async function getOfficeChatPreferences(){
 const current=await actor();
 const {data,error}=await current.admin.from("office_chat_user_preferences")
  .select("notify_direct,notify_mentions,notify_ticket_updates,email_digest_opt_in,share_read_receipts,reduce_motion,updated_at")
  .eq("user_id",current.identity.userId).maybeSingle();
 if(error)throw new OfficeChatPreferencesError(503,"Personal preference ledger unavailable");
 return {scope:"OWN" as const,preferences:data??defaults,updated_at:data?.updated_at??null};
}
export async function saveOfficeChatPreferences(input:ConnectPrefs){
 const current=await actor();
 const {data,error}=await current.admin.rpc("office_chat_update_preferences",{
  p_actor:current.identity.userId,p_notify_direct:input.notify_direct,p_notify_mentions:input.notify_mentions,
  p_notify_ticket_updates:input.notify_ticket_updates,p_email_digest_opt_in:input.email_digest_opt_in,
  p_share_read_receipts:input.share_read_receipts,p_reduce_motion:input.reduce_motion,
 });
 if(error||data!==true)throw new OfficeChatPreferencesError(409,"Settings were not saved");
 return getOfficeChatPreferences();
}
