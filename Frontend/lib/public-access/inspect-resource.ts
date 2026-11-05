import { createHash } from "node:crypto";
const TYPES = ["application/pdf","text/plain","text/csv"] as const;
export type AllowedPublicType = typeof TYPES[number];

export function inspectPublicResource(data:Uint8Array,type:string) {
  if (!(TYPES as readonly string[]).includes(type)) return {valid:false,reason:"Unsupported resource file type."} as const;
  if (!data.length || data.length>2*1024*1024) return {valid:false,reason:"File must be smaller than 2 MiB."} as const;
  const raw=Buffer.from(data);
  if(type==="application/pdf") {
    const begin=raw.subarray(0,8).toString("latin1");
    const end=raw.subarray(Math.max(0,raw.length-2048)).toString("latin1");
    if(!begin.startsWith("%PDF-")||!end.includes("%%EOF"))return {valid:false,reason:"Invalid PDF structure."} as const;
    // Conservative pre-publish blocklist; external malware review remains mandatory.
    if(/\/(?:JavaScript|JS|OpenAction|Launch|EmbeddedFile|AA)\b/i.test(raw.toString("latin1"))) {
      return {valid:false,reason:"Interactive or embedded PDF content is not permitted."} as const;
    }
  } else {
    let text:string;
    try {text=new TextDecoder("utf-8",{fatal:true}).decode(data);}
    catch {return {valid:false,reason:"Invalid UTF-8 text."} as const;}
    if(text.includes("\0")||/<(?:script|html|iframe|object|svg)\b/i.test(text)) {
      return {valid:false,reason:"Executable or HTML-like content is not permitted."} as const;
    }
    // Prevent spreadsheet formula injection when customers open exported CSV.
    if(type==="text/csv"&&text.split(/\r?\n/).some(line=>line.split(",").some(field=>/^\s*["']?[=+@\t\r]/.test(field)))) {
      return {valid:false,reason:"CSV formula-like fields are not permitted."} as const;
    }
  }
  return {valid:true,bytes:data.length,sha256:createHash("sha256").update(data).digest("hex")} as const;
}
