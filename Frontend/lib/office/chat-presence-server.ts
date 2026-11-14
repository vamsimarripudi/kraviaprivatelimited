import "server-only";
import {requireOfficeChatConversation,getOfficeChatMembers,OfficeChatError} from "@/lib/office/chat-server";
export async function getOfficeChatTyping(conversationId:string){
 const current=await requireOfficeChatConversation(conversationId);
 const members=await getOfficeChatMembers(conversationId);
 const users=new Map(members.members.map(p=>[String(p.user_id),String(p.display_name??"Employee")]));
 const now=new Date();
 const {data,error}=await current.admin.from("office_chat_typing_presence")
  .select("user_id,last_signal")
  .eq("conversation_id",conversationId)
  .eq("is_typing",true)
  .gt("last_signal",new Date(now.getTime()-10000).toISOString())
  .order("last_signal",{ascending:false}).limit(80);
 if(error)throw new OfficeChatError(503,"Private presence temporarily unavailable");
 return {typing:(data??[]).filter(row=>row.user_id!==current.identity.userId&&
   users.has(String(row.user_id))).map(row=>({
   user_id:String(row.user_id),display_name:users.get(String(row.user_id))??"Employee"
  })).slice(0,6),
  as_of:now.toISOString()};
}
export async function setOfficeChatTyping(conversationId:string,isTyping:boolean){
 const current=await requireOfficeChatConversation(conversationId);
 const {error}=await current.admin.from("office_chat_typing_presence").upsert({
  conversation_id:conversationId,user_id:current.identity.userId,
  is_typing:isTyping,last_signal:new Date().toISOString(),
 },{onConflict:"conversation_id,user_id"});
 if(error)throw new OfficeChatError(503,"Typing signal was not confirmed");
 return {recorded:true};
}
