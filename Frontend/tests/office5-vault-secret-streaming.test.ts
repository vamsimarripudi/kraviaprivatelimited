import {describe,it,expect} from "vitest";
import {streamSealedDocument} from "../lib/office/vault-secret-byte-stream";
import {readFileSync} from "node:fs";
const download=readFileSync(new URL("../app/api/office-vault/secrets/[id]/download/route.ts",import.meta.url),"utf8");
const preview=readFileSync(new URL("../app/api/office-vault/secrets/[id]/preview/route.ts",import.meta.url),"utf8");
describe("K-Vault protected byte streaming",()=>{
 it("streams a greater-than-4.5 MiB decrypted file in bounded chunks",async()=>{
  const original=Buffer.alloc(5*1024*1024+100,0x45);
  const reader=streamSealedDocument(original).getReader();
  let received=0,max=0;
  while(true){
   const result=await reader.read();
   if(result.done)break;
   max=Math.max(max,result.value.byteLength);
   expect(result.value.every(v=>v===0x45)).toBe(true);
   received+=result.value.byteLength;
  }
  expect(received).toBe(5*1024*1024+100);
  expect(max).toBeLessThanOrEqual(65536);
  expect(original.every(v=>v===0)).toBe(true);
 });
 it("wipes held secret bytes if a viewer cancels a stream",async()=>{
  const secret=Buffer.alloc(250000,0x69);
  const reader=streamSealedDocument(secret).getReader();
  await reader.read();
  await reader.cancel();
  expect(secret.every(v=>v===0)).toBe(true);
 });
 it("never writes decrypted evidence into a signed public URL",()=>{
  for(const route of [download,preview]){
   expect(route).toContain("streamSealedDocument(file.bytes)");
   expect(route).toContain('Cache-Control":"private, no-store"');
   expect(route).not.toContain("createSignedUrl");
   expect(route).not.toContain("new Uint8Array(file.bytes)");
  }
 });
});
