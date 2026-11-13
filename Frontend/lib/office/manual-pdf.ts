/**
 * Minimal dependency-free PDF writer for the private employee handbook.
 * Uses built-in Helvetica and ASCII-normalized text, which keeps the output
 * deterministic and avoids sending employee content to an external renderer.
 * For long-form design-rich manuals, use the separately published master PDF.
 */
import { type ManualRole } from "@/lib/office/manuals";

type Chapter = {title:string;steps:readonly string[]};
type Route = {href:string;title:string;description:string};
type Pack = {edition:string;common:readonly Chapter[];roles:readonly ManualRole[];routes:readonly Route[]};
type Line = {text:string;kind:"title"|"sub"|"heading"|"body"};
const clean=(value:string)=>value.normalize("NFKD")
  .replace(/[\u2010-\u2015\u2212]/g,"-").replace(/[\u2018\u2019]/g,"'")
  .replace(/[\u201c\u201d]/g,'"').replace(/[\u2022]/g,"*")
  .replace(/[^\x20-\x7e]/g," ").replace(/\s+/g," ").trim();
const escaped=(value:string)=>clean(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
function wrap(value:string,limit:number):string[]{
  const words=clean(value).split(" ").filter(Boolean);
  const lines:string[]=[];let current="";
  for(const word of words){
    if(word.length>limit){if(current)lines.push(current);current="";for(let i=0;i<word.length;i+=limit)lines.push(word.slice(i,i+limit));continue;}
    if(current.length+word.length+1>limit){if(current)lines.push(current);current=word;}
    else current=current?current+" "+word:word;
  }
  if(current)lines.push(current);
  return lines.length?lines:[""];
}
function buildLines(pack:Pack):Line[]{
  const out:Line[]=[];
  const put=(kind:Line["kind"],v:string,wrapLength=94)=>{
    for(const text of wrap(v,wrapLength))out.push({kind,text});
  };
  put("title","KRAVIA OFFICE - PRIVATE EMPLOYEE USER MANUAL",54);
  put("sub","Edition "+pack.edition+" | Common guide + assigned role guidance",85);
  put("sub","This guide provides directions only. It does not grant authority, prove payment or replace a signed appointment.",94);
  out.push({kind:"body",text:" "});
  pack.common.forEach(chapter=>{
    put("heading",chapter.title,68);
    chapter.steps.forEach((step,index)=>put("body",String(index+1)+". "+step));
    out.push({kind:"body",text:" "});
  });
  pack.roles.forEach(role=>{
    put("heading","ROLE GUIDE: "+role.name.toUpperCase(),72);
    put("body",role.purpose);
    put("sub","First access");role.firstDay.forEach((step,i)=>put("body",(i+1)+". "+step));
    put("sub","Daily operations");role.daily.forEach((step,i)=>put("body",(i+1)+". "+step));
    put("sub","Completion evidence");put("body",role.completion);
    put("sub","Authority boundary");put("body",role.boundaries);
    out.push({kind:"body",text:" "});
  });
  put("heading","YOUR CURRENTLY PERMITTED OFFICE ROUTES",68);
  pack.routes.forEach((route,i)=>{
    put("body",String(i+1)+". "+route.title+" - "+route.href,90);
    put("body","   "+route.description,94);
  });
  put("sub","Privacy: Do not forward private handbook copies outside your authorized company channel.");
  put("sub","A guide acknowledgement confirms reading only. No bank, employment or statutory status is inferred.");
  return out;
}
function drawLine(line:Line,y:number):string {
  const size=line.kind==="title"?16:line.kind==="heading"?12:line.kind==="sub"?10:9;
  const font=line.kind==="body"?"F1":"F2";
  const dark=line.kind==="title"?"0.08 0.22 0.35":line.kind==="heading"?"0.12 0.32 0.49":"0.14 0.20 0.27";
  return "BT /"+font+" "+size+" Tf "+dark+" rg 1 0 0 1 48 "+y+" Tm ("+escaped(line.text)+") Tj ET\n";
}
function pagesFromLines(lines:Line[]):Line[][]{
  const pages:Line[][]=[[]];let y=775;
  for(const line of lines){
    const height=line.kind==="title"?26:line.kind==="heading"?21:line.kind==="sub"?18:14;
    if(y-height<66){pages.push([]);y=775;}
    pages[pages.length-1].push(line);y-=height;
  }
  return pages;
}
function contentStream(lines:Line[],pageIndex:number,total:number):string{
  let output="0.86 0.89 0.93 RG 0.7 w 48 806 m 547 806 l S\n";
  output+=drawLine({kind:"sub",text:"KRAVIA PRIVATE LIMITED - INTERNAL GUIDANCE"},812);
  let y=775;
  for(const line of lines){
    output+=drawLine(line,y);
    y-=line.kind==="title"?26:line.kind==="heading"?21:line.kind==="sub"?18:14;
  }
  output+="0.86 0.89 0.93 RG 0.7 w 48 51 m 547 51 l S\n";
  output+=drawLine({kind:"body",text:"PRIVATE | Versioned guidance - Page "+(pageIndex+1)+" of "+total},34);
  return output;
}
export function renderOfficeManualPdf(pack:Pack):Uint8Array{
  const pages=pagesFromLines(buildLines(pack));
  const objects:string[]=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids ["+pages.map((_,i)=>String(5+i*2)+" 0 R").join(" ")+"] /Count "+pages.length+" >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  pages.forEach((lines,index)=>{
    const pageNo=5+index*2,streamNo=pageNo+1;
    const stream=contentStream(lines,index,pages.length);
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+streamNo+" 0 R >>");
    objects.push("<< /Length "+Buffer.byteLength(stream,"ascii")+" >>\nstream\n"+stream+"endstream");
  });
  let output="%PDF-1.4\n";
  const offsets=[0];
  objects.forEach((obj,i)=>{
    offsets.push(Buffer.byteLength(output,"ascii"));
    output+=String(i+1)+" 0 obj\n"+obj+"\nendobj\n";
  });
  const start=Buffer.byteLength(output,"ascii");
  output+="xref\n0 "+String(objects.length+1)+"\n0000000000 65535 f \n";
  for(let i=1;i<offsets.length;i++)output+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  output+="trailer\n<< /Size "+String(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+start+"\n%%EOF\n";
  return new Uint8Array(Buffer.from(output,"ascii"));
}
