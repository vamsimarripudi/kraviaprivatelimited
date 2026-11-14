import { Buffer } from "node:buffer";
import { deflateRawSync } from "node:zlib";
import { describe,expect,it } from "vitest";
import { extractKraviaAttendanceWorkbook } from "../lib/office/hr-attendance-workbook";

function crc32(data:Buffer){
  let n=0xffffffff;for(const byte of data){n^=byte;for(let k=0;k<8;k++)n=(n&1)?(n>>>1)^0xedb88320:n>>>1;}
  return (n^0xffffffff)>>>0;
}
function zip(files:Record<string,string>):Buffer{
  const locals:Buffer[]=[],centrals:Buffer[]=[];
  let position=0;
  for(const [name,text] of Object.entries(files)){
    const nameBytes=Buffer.from(name),data=Buffer.from(text);
    const packed=deflateRawSync(data);
    const local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
    local.writeUInt16LE(8,8);local.writeUInt32LE(crc32(data),14);
    local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);
    local.writeUInt16LE(nameBytes.length,26);
    locals.push(local,nameBytes,packed);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);
    central.writeUInt32LE(crc32(data),16);central.writeUInt32LE(packed.length,20);
    central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28);
    central.writeUInt32LE(position,42);
    centrals.push(central,nameBytes);
    position+=local.length+nameBytes.length+packed.length;
  }
  const cd=Buffer.concat(centrals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(Object.keys(files).length,8);
  end.writeUInt16LE(Object.keys(files).length,10);
  end.writeUInt32LE(cd.length,12);
  end.writeUInt32LE(position,16);
  return Buffer.concat([...locals,cd,end]);
}
const inline=(cell:string,value:string)=>
  '<c r="'+cell+'" t="inlineStr"><is><t>'+value+'</t></is></c>';
const numeric=(cell:string,value:number)=>'<c r="'+cell+'"><v>'+value+'</v></c>';
const row=(id:number,content:string)=>'<row r="'+id+'">'+content+'</row>';
function workbook(options?:{missingEvidence?:boolean;duplicate?:boolean;editSource?:boolean}):Buffer{
  const sheets=["Source Sessions","Aug 2026","Sep 2026","Oct 2026","Nov 2026"];
  const files:Record<string,string>={
    "xl/workbook.xml":'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
      sheets.map((name,index)=>'<sheet name="'+name+'" sheetId="'+(index+1)+'" r:id="rId'+(index+1)+'"/>').join("")+
      '</sheets></workbook>',
    "xl/_rels/workbook.xml.rels":'<Relationships>'+
      sheets.map((_,index)=>'<Relationship Id="rId'+(index+1)+'" Target="worksheets/sheet'+(index+1)+'.xml"/>').join("")+
      '</Relationships>',
  };
  files["xl/worksheets/sheet1.xml"]='<worksheet><sheetData>'+
    row(4,inline("A4","Employee")+inline("B4","Session ID"))+
    row(5,inline("A5","Jaya M")+inline("B5","sample-source-id"))+
    '</sheetData></worksheet>';
  sheets.slice(1).forEach((name,index)=>{
    const isNov=index===3;
    const hdr=row(4,inline("A4","Employee")+inline("B4","IST date")+
      inline("J4","Verified/payable min*")+inline("M4","Signed source reference*"));
    const body=row(5,inline("A5","Jaya M")+numeric("B5",isNov?46339:46235+index*31)+
      (isNov?numeric("J5",360)+numeric("K5",0)+numeric("L5",78)+
        (options?.missingEvidence?"":inline("M5","SIGNED-WORK-REGISTER-2026"))+
        inline("N5","APPROVED"):inline("N5","NOT REVIEWED")));
    const duplicate=options?.duplicate&&isNov?
      row(6,inline("A6","Jaya M")+numeric("B6",46339)+numeric("J6",180)+inline("M6","SIGNED-WORK-REGISTER-SECOND")):"";
    files["xl/worksheets/sheet"+(index+2)+".xml"]='<worksheet><sheetData>'+
      hdr+body+duplicate+'</sheetData></worksheet>';
  });
  if(options?.editSource) files["xl/worksheets/sheet1.xml"]=
    files["xl/worksheets/sheet1.xml"].replace('Session ID','Changed');
  return zip(files);
}
describe("KRAVIA template-specific HR attendance extraction",()=>{
  it("reads edited Aug–Nov evidence without treating workbook APPROVED as an actual approval",()=>{
    const result=extractKraviaAttendanceWorkbook(workbook());
    expect(result.sourceSessions).toBe(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      sheet:"Nov 2026",row:5,employee:"Jaya M",workDate:"2026-11-13",
      payableMinutes:360,paidLeaveMinutes:0,overtimeCandidateMinutes:78,
      workbookDecision:"APPROVED"
    });
    expect(result.issues.some(item=>item.severity==="WARNING"&&item.detail.includes("OT requires"))).toBe(true);
    expect(result.candidates[0]).not.toHaveProperty("status","APPROVED");
  });
  it("rejects missing evidence and duplicate employee/day rows",()=>{
    expect(extractKraviaAttendanceWorkbook(workbook({missingEvidence:true})).issues.some(x=>x.severity==="ERROR")).toBe(true);
    expect(extractKraviaAttendanceWorkbook(workbook({duplicate:true})).issues.some(x=>x.detail.includes("Duplicate"))).toBe(true);
  });
  it("rejects renamed source columns, garbage ZIP, and macro-containing ZIP files",()=>{
    expect(()=>extractKraviaAttendanceWorkbook(workbook({editSource:true}))).toThrow(/Source Sessions/);
    expect(()=>extractKraviaAttendanceWorkbook(Buffer.from("invalid"))).toThrow();
    const unsafe=zip({"xl/vbaProject.bin":"macros","xl/workbook.xml":"x"});
    expect(()=>extractKraviaAttendanceWorkbook(unsafe)).toThrow(/Macros|unsafe/i);
  });
});
