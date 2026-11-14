import { inflateRawSync } from "node:zlib";

export class HrWorkbookError extends Error {
  constructor(message: string) { super(message); this.name = "HrWorkbookError"; }
}
export type HrExtractedRow = {
  key: string; sheet: string; row: number; employee: string; workDate: string;
  payableMinutes: number; paidLeaveMinutes: number; overtimeCandidateMinutes: number;
  evidenceReference: string; workbookDecision: string; sourceStatus: string;
};
export type HrExtractIssue = {
  sheet: string; row: number; employee: string; severity: "ERROR" | "WARNING"; detail: string;
};
export type HrExtraction = {
  sourceSessions: number; sheetsRead: string[]; candidates: HrExtractedRow[];
  issues: HrExtractIssue[]; ignoredUneditedDays: number;
};
const MONTHS = ["Aug 2026","Sep 2026","Oct 2026","Nov 2026"] as const;
const MAX_FILE = 2_097_152;
function reject(message:string):never { throw new HrWorkbookError(message); }
function crc32(data:Buffer):number {
  let n=0xffffffff;
  for(const byte of data){n^=byte;for(let j=0;j<8;j++)n=(n&1)?(n>>>1)^0xedb88320:n>>>1;}
  return (n^0xffffffff)>>>0;
}
function unzip(input:Uint8Array):Map<string,string>{
  const data=Buffer.from(input);
  if(data.length<22||data.length>MAX_FILE||data.subarray(0,2).toString("ascii")!=="PK")
    reject("Upload a real .xlsx workbook smaller than 2 MiB");
  let end=-1;
  for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)
    if(data.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)reject("XLSX ZIP directory is missing");
  let offset=data.readUInt32LE(end+16);
  const count=data.readUInt16LE(end+10);
  if(count<1||count>150||offset+data.readUInt32LE(end+12)>end||data.readUInt16LE(end+8)!==count)
    reject("XLSX archive is unsafe or unsupported");
  let expandedTotal=0;
  const parts=new Map<string,string>();
  for(let i=0;i<count;i++){
    if(offset+46>data.length||data.readUInt32LE(offset)!==0x02014b50)reject("Corrupt ZIP entry");
    const flags=data.readUInt16LE(offset+8),method=data.readUInt16LE(offset+10);
    const crc=data.readUInt32LE(offset+16),packed=data.readUInt32LE(offset+20);
    const unpacked=data.readUInt32LE(offset+24),nameLength=data.readUInt16LE(offset+28);
    const extraLength=data.readUInt16LE(offset+30),commentLength=data.readUInt16LE(offset+32);
    const local=data.readUInt32LE(offset+42);
    if((flags&1)!==0||![0,8].includes(method)||unpacked>4_194_304||
      packed>MAX_FILE||nameLength>300||offset+46+nameLength+extraLength+commentLength>data.length)
      reject("Encrypted, oversized or damaged ZIP part");
    const name=data.toString("utf8",offset+46,offset+46+nameLength);
    offset+=46+nameLength+extraLength+commentLength;
    if(name.includes("..")||name.startsWith("/")||name.includes("\\")||
      name.startsWith("xl/externalLinks/")||name.includes("vbaProject")||name.endsWith(".bin"))
      reject("Macros or unsafe workbook paths are prohibited");
    expandedTotal+=unpacked;
    if(expandedTotal>12_582_912)reject("XLSX decompression limit exceeded");
    if(!name.startsWith("xl/")||!(name.endsWith(".xml")||name.endsWith(".rels")))continue;
    if(local+30>data.length||data.readUInt32LE(local)!==0x04034b50)reject("Bad ZIP header");
    const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);
    if(start+packed>data.length)reject("Bad ZIP size");
    let raw:Buffer;
    try {
      raw=method===0?data.subarray(start,start+packed):
        inflateRawSync(data.subarray(start,start+packed),{maxOutputLength:4_194_305});
    }catch{reject("XLSX decompression failed");}
    if(raw.length!==unpacked||crc32(raw)!==crc)reject("Workbook ZIP integrity check failed");
    const xml=raw.toString("utf8");
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))reject("XML entities are not accepted");
    parts.set(name,xml);
  }
  return parts;
}
function decode(value:string):string{
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,(_,entity:string)=>{
    if(entity.startsWith("#")){
      const x=entity[1]?.toLowerCase()==="x"?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
      return x>=0&&x<=0x10ffff?String.fromCodePoint(x):"";
    }
    return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"} as Record<string,string>)[entity.toLowerCase()]||"";
  });
}
function attr(text:string,key:string):string {
  const pattern=new RegExp("(?:^|\\s)"+key.replace(/[^A-Za-z0-9:]/g,"\\$&")+"=[\"']([^\"']*)[\"']");
  return decode(text.match(pattern)?.[1]||"");
}
function xmlText(text:string):string {
  return [...text.matchAll(/<(?:[A-Za-z][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?t>/g)].map(m=>decode(m[1])).join("");
}
type Cell=string|number|null;
type SheetRows=Map<number,Map<number,Cell>>;
function parseSheet(xml:string,strings:string[]):SheetRows{
  const rows:SheetRows=new Map();
  let count=0;
  for(const match of xml.matchAll(/<(?:[A-Za-z][\w.-]*:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?row>/g)){
    const line=Number(attr(match[1],"r"));
    if(!Number.isSafeInteger(line)||line<1||line>2000||rows.has(line))reject("Invalid or duplicate worksheet row");
    const cells=new Map<number,Cell>();
    for(const cell of match[2].matchAll(/<(?:[A-Za-z][\w.-]*:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?c>)/g)){
      const code=attr(cell[1],"r").match(/^([A-Z]{1,3})[0-9]+$/)?.[1];
      if(!code)continue;
      const col=[...code].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0)-1;
      if(col>30)continue;
      if(cells.has(col))reject("Duplicate XLSX cell");
      const raw=cell[2]||"";
      if(col>=9&&col<=13&&/<(?:[A-Za-z][\w.-]*:)?f\b/.test(raw))
        reject("HR-editable cells must be literal values, not spreadsheet formulas");
      const v=raw.match(/<(?:[A-Za-z][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?v>/)?.[1];
      const t=attr(cell[1],"t");
      let value:Cell=null;
      if(t==="s"){
        const id=Number(v);
        if(!Number.isSafeInteger(id)||id<0||id>=strings.length)reject("Invalid shared-string index");
        value=strings[id];
      }else if(t==="inlineStr"||t==="str")value=xmlText(raw)||(v===undefined?null:decode(v));
      else if(v!==undefined){
        const n=Number(v);value=Number.isFinite(n)?n:decode(v);
      }else if(/<(?:[A-Za-z][\w.-]*:)?is\b/.test(raw))value=xmlText(raw);
      cells.set(col,value);
      if(++count>35000)reject("Workbook contains too many data cells");
    }
    rows.set(line,cells);
  }
  return rows;
}
function readSheets(parts:Map<string,string>):Map<string,SheetRows>{
  const workbook=parts.get("xl/workbook.xml"),relations=parts.get("xl/_rels/workbook.xml.rels");
  if(!workbook||!relations)reject("Missing XLSX workbook metadata");
  const links=new Map<string,string>();
  for(const r of relations.matchAll(/<Relationship\b([^>]*?)(?:\/>|>)/g)){
    const id=attr(r[1],"Id"),target=attr(r[1],"Target");
    if(id&&target){
      const path=target.startsWith("/")?target.slice(1):"xl/"+target.replace(/^\.?\//,"");
      if(!path.includes(".."))links.set(id,path);
    }
  }
  const strings=[...(parts.get("xl/sharedStrings.xml")||"").matchAll(/<(?:[A-Za-z][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z][\w.-]*:)?si>/g)]
    .map(x=>xmlText(x[1]));
  const sheets=new Map<string,SheetRows>();
  for(const x of workbook.matchAll(/<(?:[A-Za-z][\w.-]*:)?sheet\b([^>]*?)(?:\/>|>)/g)){
    const name=attr(x[1],"name"),id=attr(x[1],"r:id"),path=links.get(id);
    if(name&&path&&parts.has(path))sheets.set(name,parseSheet(parts.get(path)!,strings));
  }
  return sheets;
}
function val(cell:Cell|undefined):string{return cell===null||cell===undefined?"":String(cell).trim();}
function date(cell:Cell|undefined):string{
  if(typeof cell==="number"&&cell>40000&&cell<80000)
    return new Date(Date.UTC(1899,11,30)+Math.floor(cell)*86_400_000).toISOString().slice(0,10);
  const s=val(cell);
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))?s:"";
}
function minutes(cell:Cell|undefined,limit:number):number|null{
  const s=val(cell);
  if(!s)return 0;
  if(!/^\d+(?:\.0+)?$/.test(s))return null;
  const n=Number(s);
  return Number.isSafeInteger(n)&&n<=limit?n:null;
}
export function extractKraviaAttendanceWorkbook(input:Uint8Array):HrExtraction{
  const sheets=readSheets(unzip(input));
  if(!sheets.has("Source Sessions")||MONTHS.some(m=>!sheets.has(m)))
    reject("Use the KRAVIA attendance reconciliation workbook with Source Sessions and Aug–Nov 2026 tabs");
  const source=sheets.get("Source Sessions")!;
  if(val(source.get(4)?.get(0))!=="Employee"||val(source.get(4)?.get(1))!=="Session ID")
    reject("Source Sessions columns were modified");
  const sourceSessions=[...source.entries()].filter(([n,row])=>n>=5&&val(row.get(1))).length;
  const candidates:HrExtractedRow[]=[],issues:HrExtractIssue[]=[];
  let ignoredUneditedDays=0;
  const unique=new Set<string>();
  for(const sheet of MONTHS){
    const rows=sheets.get(sheet)!;
    const head=rows.get(4);
    if(val(head?.get(0))!=="Employee"||val(head?.get(1))!=="IST date"||
       val(head?.get(9))!=="Verified/payable min*"||
       val(head?.get(12))!=="Signed source reference*")
      reject("Monthly reconciliation header is invalid: "+sheet);
    for(const [number,cells] of rows){
      if(number<5)continue;
      const employee=val(cells.get(0));if(!employee)continue;
      const ref=val(cells.get(12)),decision=val(cells.get(13));
      const touched=[9,10,11].some(c=>val(cells.get(c))!=="")||
        !!ref||(!!decision&&decision.toUpperCase()!=="NOT REVIEWED");
      if(!touched){ignoredUneditedDays++;continue;}
      const issue=(detail:string,severity:"ERROR"|"WARNING"="ERROR")=>
        issues.push({sheet,row:number,employee,severity,detail});
      const workDate=date(cells.get(1));
      const target=({Aug:"08",Sep:"09",Oct:"10",Nov:"11"} as Record<string,string>)[sheet.slice(0,3)];
      if(!workDate.startsWith("2026-"+target+"-")){issue("Invalid or mismatched IST date");continue;}
      const pay=minutes(cells.get(9),360),leave=minutes(cells.get(10),360),ot=minutes(cells.get(11),1440);
      if(pay===null||leave===null||ot===null){issue("Enter nonnegative whole minutes within allowed limits");continue;}
      if(pay+leave>360){issue("Regular payable plus paid leave must not exceed 360 minutes");continue;}
      if(ref.length<8||ref.length>500){issue("Real signed/source evidence reference must contain 8–500 characters");continue;}
      if(!pay&&!leave&&!ot){issue("No verified or proposed hours supplied");continue;}
      const day=new Date(workDate+"T00:00:00Z").getUTCDay();
      if((day===0||day===6)&&leave)issue("Weekend paid leave requires separate policy review");
      if((day===0||day===6)&&pay)issue("Weekend work is a candidate only—not ordinary payable time","WARNING");
      if(ot)issue("OT requires a separate effective policy and independent approval","WARNING");
      if(/OPEN|EXCEPTION/i.test(val(cells.get(8))))
        issue("Unresolved original attendance requires HR investigation","WARNING");
      const key=employee.toLowerCase()+"|"+workDate;
      if(unique.has(key)){issue("Duplicate employee/day across workbook");continue;}
      unique.add(key);
      candidates.push({key:sheet+":"+number,sheet,row:number,employee,workDate,
        payableMinutes:pay,paidLeaveMinutes:leave,overtimeCandidateMinutes:ot,
        evidenceReference:ref,workbookDecision:decision.slice(0,80),
        sourceStatus:val(cells.get(8)).slice(0,140)});
    }
  }
  if(candidates.length>400)reject("Upload batches are limited to 400 edited days");
  return {sourceSessions,sheetsRead:[...MONTHS,"Source Sessions"],candidates,issues,ignoredUneditedDays};
}
