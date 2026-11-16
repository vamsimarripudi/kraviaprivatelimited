import "server-only";
import {requireOfficeActor,OfficePermissionError} from "@/lib/office/permission-engine";
import {getOfficeChatMembers,requireOfficeChatConversation,OfficeChatError} from "@/lib/office/chat-server";

export type LastSeenVisibility="COWORKERS"|"CONVERSATIONS"|"NOBODY";
export type OnlineVisibility="COWORKERS"|"SAME_AS_LAST_SEEN";
export type OfficeChatOnlinePreferences={
  last_seen_visibility:LastSeenVisibility;
  online_visibility:OnlineVisibility;
};
const defaults:OfficeChatOnlinePreferences={
  last_seen_visibility:"COWORKERS",
  online_visibility:"SAME_AS_LAST_SEEN",
};
async function verifiedActor(){
 try{
  const current=await requireOfficeActor();
  if(current.identity.workspaceStatus!=="ACTIVE")
   throw new OfficeChatError(403,"Active Office access required");
  return current;
 }catch(error){
  if(error instanceof OfficePermissionError)
   throw new OfficeChatError(error.status,error.message);
  throw error;
 }
}
export async function getMyOfficeChatOnlinePreferences(){
 const current=await verifiedActor();
 const result=await current.admin.from("office_chat_presence_state")
  .select("last_seen_visibility,online_visibility,last_seen_at")
  .eq("user_id",current.identity.userId).maybeSingle();
 if(result.error)throw new OfficeChatError(503,"Chat presence settings unavailable");
 return {
  scope:"OWN" as const,
  preferences:{
   last_seen_visibility:(result.data?.last_seen_visibility??defaults.last_seen_visibility) as LastSeenVisibility,
   online_visibility:(result.data?.online_visibility??defaults.online_visibility) as OnlineVisibility,
  },
  last_seen_at:result.data?.last_seen_at??null,
 };
}
export async function saveMyOfficeChatOnlinePreferences(input:OfficeChatOnlinePreferences){
 const current=await verifiedActor();
 const result=await current.admin.rpc("office_chat_presence_set_privacy",{
  p_actor:current.identity.userId,
  p_last_seen:input.last_seen_visibility,
  p_online:input.online_visibility,
 });
 if(result.error||result.data!==true)throw new OfficeChatError(409,"Presence preferences were not saved");
 return getMyOfficeChatOnlinePreferences();
}
export async function pulseMyOfficeChatOnline(deviceId:string,online:boolean){
 const current=await verifiedActor();
 const result=await current.admin.rpc("office_chat_presence_pulse",{
  p_actor:current.identity.userId,p_device:deviceId,p_online:online,
 });
 if(result.error||typeof result.data!=="boolean")
  throw new OfficeChatError(503,"Unable to update private device presence");
 return {online:result.data,updated_at:new Date().toISOString()};
}
export type VisibleChatPresence={
 user_id:string;online:boolean;last_seen_at:string|null;
};
export async function getOfficeConversationOnlinePresence(conversationId:string){
 const current=await requireOfficeChatConversation(conversationId);
 const roster=await getOfficeChatMembers(conversationId);
 const ids=roster.members.map(m=>String(m.user_id));
 if(!ids.length)return {members:[] as VisibleChatPresence[],as_of:new Date().toISOString()};
 const now=new Date();
 const [states,devices]=await Promise.all([
  current.admin.from("office_chat_presence_state")
   .select("user_id,last_seen_visibility,online_visibility,last_seen_at")
   .in("user_id",ids).limit(100),
  current.admin.from("office_chat_presence_devices")
   .select("user_id").in("user_id",ids)
   .gt("lease_until",now.toISOString()).limit(1000),
 ]);
 if(states.error||devices.error)
  throw new OfficeChatError(503,"Authorized conversation presence unavailable");
 const found=new Map((states.data??[]).map(s=>[String(s.user_id),s]));
 const active=new Set((devices.data??[]).map(d=>String(d.user_id)));
 return {members:ids.map(userId=>{
  const state=found.get(userId);
  const own=userId===current.identity.userId;
  // Conversation access was checked first; never reveal company-wide activity.
  const showLast=own||state?.last_seen_visibility!=="NOBODY";
  const showOnline=own||state?.online_visibility==="COWORKERS"||showLast;
  return {
   user_id:userId,
   online:showOnline&&active.has(userId),
   last_seen_at:showLast?(state?.last_seen_at??null):null,
  };
 }),as_of:now.toISOString()};
}
