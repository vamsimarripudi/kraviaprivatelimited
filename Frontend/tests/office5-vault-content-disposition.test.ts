import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {privateDocumentDisposition} from "../lib/office/vault-download-disposition";
const route=readFileSync(new URL("../app/api/office-vault/secrets/[id]/download/route.ts",import.meta.url),"utf8");
describe("K-Vault protected download headers",()=>{
 it("encodes Unicode names in RFC-compatible ASCII response headers",()=>{
  const disposition=privateDocumentDisposition("తెలుగు résumé.pdf");
  expect(disposition).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
  expect(disposition).toContain("%E0%B0");
  expect([...disposition].every(ch=>ch.charCodeAt(0)<128)).toBe(true);
 });
 it("removes control characters and separators from filename fallback",()=>{
  const disposition=privateDocumentDisposition('bank\r\nX-Injected:yes/\\\\".pdf');
  expect(disposition).not.toContain("\r");
  expect(disposition).not.toContain("\n");
  expect(disposition).not.toContain("X-Injected:yes/");
 });
 it("does not throw for malformed Unicode inherited from old metadata",()=>{
  expect(privateDocumentDisposition("broken"+String.fromCharCode(0xD800)+"name.pdf")).toContain("filename*=UTF-8''");
 });
 it("keeps private document hashes out of HTTP cache identifiers",()=>{
  expect(route).toContain('privateDocumentDisposition(file.filename)');
  expect(route).toContain('Cache-Control":"private, no-store"');
  expect(route).toContain('"Referrer-Policy":"no-referrer"');
  expect(route).not.toContain('"ETag"');
  expect(route).not.toContain("createSignedUrl");
  expect(route).toContain("if(!transferred)file.bytes.fill(0)");
 });
});
