import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const download=readFileSync(new URL("../app/api/office-vault/secrets/[id]/download/route.ts",import.meta.url),"utf8");
const preview=readFileSync(new URL("../app/api/office-vault/secrets/[id]/preview/route.ts",import.meta.url),"utf8");
describe("K-Vault protected route response construction",()=>{
 it("wipes decrypted bytes when download headers or response construction fail",()=>{
  expect(download).toContain("const response=new Response(streamSealedDocument(file.bytes)");
  expect(download).toContain("finally{if(!transferred)file.bytes.fill(0);}");
 });
 it("does not return unsupported private preview bytes or leak them on failure",()=>{
  expect(preview).toContain('if(file.mime!=="application/pdf"');
  expect(preview).toContain("file.bytes.fill(0)");
  expect(preview).toContain("finally{if(!transferred)file.bytes.fill(0);}");
  expect(preview).toContain('"Content-Disposition":"inline"');
 });
});
