/** Aggregate only currently permission-scoped case records from OfficeSupport.
 * No employee performance scores, invented SLA deadlines or customer PII. */
export type InsightCase={category:string;status:string;created_at:string;
 due_at?:string|null;resolved_at?:string|null};
export type SupportPeriod=7|30|90|null;
const day=86_400_000;
const closed=new Set(["RESOLVED","CLOSED"]);
const time=(raw?:string|null):number|null=>{
 if(!raw)return null;
 const value=Date.parse(raw);return Number.isFinite(value)?value:null;
};
export function summarizeSupportCases(rows:readonly InsightCase[],period:SupportPeriod,now:number){
 const cutoff=period===null?-Infinity:now-period*day;
 const eligible=rows.filter(row=>{
  const created=time(row.created_at);
  return created!==null&&created<=now&&created>=cutoff;
 });
 const active=eligible.filter(row=>!closed.has(row.status));
 const overdue=active.filter(row=>{
  const deadline=time(row.due_at);
  return deadline!==null&&deadline<now;
 });
 const resolutionHours=eligible.flatMap(row=>{
  if(!closed.has(row.status))return [];
  const start=time(row.created_at),end=time(row.resolved_at);
  return start===null||end===null||end<start?[]:[(end-start)/3_600_000];
 }).sort((a,b)=>a-b);
 const midpoint=Math.floor(resolutionHours.length/2);
 const median=resolutionHours.length===0?null:resolutionHours.length%2?
  resolutionHours[midpoint]:(resolutionHours[midpoint-1]+resolutionHours[midpoint])/2;
 const byCategory=new Map<string,number>();
 for(const row of eligible){
  const key=row.category?.trim().toUpperCase()||"UNCLASSIFIED";
  byCategory.set(key,(byCategory.get(key)||0)+1);
 }
 const categories=[...byCategory].map(([name,count])=>({name,count}))
  .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const weekStart=new Date(now);
 weekStart.setUTCHours(0,0,0,0);
 weekStart.setUTCDate(weekStart.getUTCDate()-((weekStart.getUTCDay()+6)%7));
 const weekly=Array.from({length:8},(_,i)=>{
  const start=weekStart.getTime()+(i-7)*7*day;
  return {start:new Date(start).toISOString().slice(0,10),
   count:eligible.filter(row=>{const created=time(row.created_at);
    return created!==null&&created>=start&&created<start+7*day;
   }).length};
 });
 return {count:eligible.length,active:active.length,overdue:overdue.length,
  median_resolution_hours:median,resolution_samples:resolutionHours.length,
  categories,weekly};
}
