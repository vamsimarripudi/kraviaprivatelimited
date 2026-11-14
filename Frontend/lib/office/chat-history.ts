/** Deterministic keyset history navigation for private Connect threads.
 * Data is still authorized for every page by the canonical Office actor. */
export type ChatHistoryPosition={id:string;created_at:string};
export type ChatHistoryCursor={at:string;id:string};
export const CHAT_HISTORY_PAGE_SIZE=50;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function chatHistoryFilter(cursor:ChatHistoryCursor):string{
 if(!uuid.test(cursor.id)||!/^[0-9T:.+Z-]+$/.test(cursor.at)||
   !Number.isFinite(Date.parse(cursor.at)))throw new Error("Invalid chat history cursor");
 // PostgREST OR: older timestamp, or same timestamp with smaller UUID.
 return "created_at.lt."+cursor.at+",and(created_at.eq."+cursor.at+",id.lt."+cursor.id+")";
}
export function compareChatHistory(a:ChatHistoryPosition,b:ChatHistoryPosition):number{
 const difference=Date.parse(a.created_at)-Date.parse(b.created_at);
 return difference!==0?difference:a.id.localeCompare(b.id);
}
export function mergeChatHistory<T extends ChatHistoryPosition>(
 existing:readonly T[],incoming:readonly T[],mode:"older"|"latest",
):T[]{
 if(mode==="latest"&&!incoming.length)return [];
 const older=mode==="latest"?existing.filter(row=>compareChatHistory(row,incoming[0])<0):existing;
 const unique=new Map<string,T>();
 for(const row of [...older,...incoming])unique.set(row.id,row);
 return [...unique.values()].sort(compareChatHistory);
}
