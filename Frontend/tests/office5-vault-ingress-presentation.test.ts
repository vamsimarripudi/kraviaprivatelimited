import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const view=readFileSync(new URL("../components/office-vault-secret-locker.tsx",import.meta.url),"utf8");
describe("K-Vault browser-side encrypted 10MiB transfer",()=>{
 it("uses authenticated 1MiB chunks rather than a Vercel-limited multipart POST",()=>{
  expect(view).toContain('const chunkSize=1_048_576;');
  expect(view).toContain('"/api/office-vault/secrets/ingress"');
  expect(view).toContain('"/parts/"+index');
  expect(view).toContain('method:"PUT"');
  expect(view).not.toContain("const form=new FormData()");
 });
 it("requires a source-completed receipt before success or clearing the selected file",()=>{
  expect(view).toContain('if(!completed.ok||!result.status)');
  expect(view).toContain('Independent reviewer approval is still required');
  expect(view).toContain("Encrypted staging cleanup requires reconciliation");
 });
 it("preserves failed-upload retries and allows confirmed cancellation",()=>{
  expect(view).toContain('uploadSession.current=sessionId');
  expect(view).toContain('Retry with the same file or cancel the staged upload');
  expect(view).toContain('action:"ABORT"');
  expect(view).toContain('if(!response.ok||result.aborted!==true)');
 });
});
