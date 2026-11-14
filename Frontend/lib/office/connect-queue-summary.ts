/** Read-only operational view of already authorized IT and Customer Support
 * records. No synthetic SLA, queue configuration or company-level totals. */
export type QueueCase={id:string;status:string;priority:string;category:string;
 owner_user_id?:string|null;due_at?:string|null;created_at:string};
export type QueueGroup={name:string;total:number;active:number;unassigned:number;urgent:number;overdue:number};
export const terminalIt=new Set(["RESOLVED","CLOSED","CANCELLED"]);
export const terminalSupport=new Set(["RESOLVED","CLOSED"]);
export function queueGroups(rows:readonly QueueCase[],terminal:ReadonlySet<string>,now:number):QueueGroup[]{
 const groups=new Map<string,QueueGroup>();
 for(const row of rows){
  const name=row.category?.trim().toUpperCase()||"UNCLASSIFIED";
  const value=groups.get(name)??{name,total:0,active:0,unassigned:0,urgent:0,overdue:0};
  const active=!terminal.has(row.status);
  const due=row.due_at?Date.parse(row.due_at):NaN;
  value.total++;
  if(active){
   value.active++;
   if(!row.owner_user_id)value.unassigned++;
   if(row.priority==="URGENT")value.urgent++;
   if(Number.isFinite(due)&&due<now)value.overdue++;
  }
  groups.set(name,value);
 }
 return [...groups.values()].sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name));
}
export function dueQueue<T extends QueueCase>(rows:readonly T[],terminal:ReadonlySet<string>,now:number){
 return rows.filter(row=>!terminal.has(row.status)&&row.due_at&&Number.isFinite(Date.parse(row.due_at)))
  .map(row=>({...row,dueTimestamp:Date.parse(row.due_at!),
    dueState:Date.parse(row.due_at!)<now?"PAST DUE":"RECORDED" as "PAST DUE"|"RECORDED"}))
  .sort((a,b)=>a.dueTimestamp-b.dueTimestamp);
}
