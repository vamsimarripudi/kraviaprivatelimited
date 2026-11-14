/** Device-local presentation settings only. Security notifications, delivery rules,
 * audit receipts and company policies remain governed by canonical Office systems. */
export const connectDisplayKey="kravia.connect.display.v1";
export const motionKey="kravia.office.motion.v1";
export type ConnectPreferences={showUnread:boolean;showMentions:boolean};
export type MotionMode="system"|"reduced"|"full";
export const defaultConnectPreferences:Readonly<ConnectPreferences>=Object.freeze({
 showUnread:true,showMentions:true,
});
export function parseConnectPreferences(value:unknown):ConnectPreferences{
 if(!value||typeof value!=="object"||Array.isArray(value))return {...defaultConnectPreferences};
 const item=value as Record<string,unknown>;
 return {showUnread:typeof item.showUnread==="boolean"?item.showUnread:true,
  showMentions:typeof item.showMentions==="boolean"?item.showMentions:true};
}
export function parseMotionMode(value:unknown):MotionMode{
 return value==="reduced"||value==="full"?value:"system";
}
export function readConnectPreferences():ConnectPreferences{
 if(typeof window==="undefined")return {...defaultConnectPreferences};
 try{return parseConnectPreferences(JSON.parse(window.localStorage.getItem(connectDisplayKey)||"null"));}
 catch{return {...defaultConnectPreferences};}
}
export function saveConnectPreferences(value:ConnectPreferences){
 if(typeof window==="undefined")return;
 try{window.localStorage.setItem(connectDisplayKey,JSON.stringify(parseConnectPreferences(value)));}
 catch{/* Storage unavailable: do not claim the preference was saved. */}
 window.dispatchEvent(new Event("kravia-connect-preferences-change"));
}
export function readMotionMode():MotionMode{
 if(typeof window==="undefined")return "system";
 try{return parseMotionMode(window.localStorage.getItem(motionKey));}
 catch{return "system";}
}
export function saveMotionMode(value:MotionMode){
 if(typeof window==="undefined")return;
 try{window.localStorage.setItem(motionKey,parseMotionMode(value));}catch{}
 window.dispatchEvent(new Event("kravia-office-motion-change"));
}
