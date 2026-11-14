import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {secretGrantRights,secretDocumentVisible,secretVersionVisible} from "../lib/office/vault-secret-visibility";
const server=readFileSync(new URL("../lib/office/vault-secret-server.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../components/office-vault-secret-locker.tsx",import.meta.url),"utf8");
describe("Sealed K-Vault confidentiality and exact grants",()=>{
 it("review permission alone never exposes unrelated approved document titles",()=>{
  expect(secretDocumentVisible({isOwner:false,canUpload:false,canRead:false,
   readGrant:false,canReview:true,hasPendingReview:false})).toBe(false);
  expect(secretDocumentVisible({isOwner:false,canUpload:false,canRead:false,
   readGrant:false,canReview:true,hasPendingReview:true})).toBe(true);
  expect(secretVersionVisible({ownerUpload:false,independentReview:true,grantedRead:false,
   reviewState:"APPROVED",scanState:"CLEAN"})).toBe(false);
 });
 it("authorizes read, preview, download independently with record scope",()=>{
  const id="doc-a";
  expect(secretGrantRights([{resource_id:id,action:"READ"}],id))
   .toEqual({read:true,preview:false,download:false});
  expect(secretGrantRights([{resource_id:id,action:"PREVIEW"}],id))
   .toEqual({read:true,preview:true,download:false});
  expect(secretGrantRights([{resource_id:id,action:"DOWNLOAD"}],"doc-b"))
   .toEqual({read:false,preview:false,download:false});
  expect(secretGrantRights([{resource_id:null,action:"DOWNLOAD"}],"doc-b"))
   .toEqual({read:true,preview:true,download:true});
 });
 it("keeps encrypted unreviewed versions hidden from grant-only readers",()=>{
  expect(secretVersionVisible({ownerUpload:false,independentReview:false,grantedRead:true,
   reviewState:"PENDING",scanState:"CLEAN"})).toBe(false);
  expect(secretVersionVisible({ownerUpload:false,independentReview:false,grantedRead:true,
   reviewState:"APPROVED",scanState:"QUARANTINED"})).toBe(false);
  expect(secretVersionVisible({ownerUpload:false,independentReview:false,grantedRead:true,
   reviewState:"APPROVED",scanState:"CLEAN"})).toBe(true);
 });
 it("keeps hidden source ownership and storage references out of API responses",()=>{
  expect(server).toContain('const pendingDocumentIds=new Set');
  expect(server).toContain('download_allowed:granted&&mayDownload&&rights.download');
  expect(server).not.toContain('documents:visible.map(d=>({...d,');
  expect(server).not.toContain('uploaded_by:v.uploaded_by');
  expect(ui).toContain("doc.download_allowed");
  expect(ui).toContain("doc.preview_allowed");
 });
});
