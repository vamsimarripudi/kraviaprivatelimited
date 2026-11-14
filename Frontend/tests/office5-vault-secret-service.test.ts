import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const server=readFileSync(new URL("../lib/office/vault-secret-server.ts",import.meta.url),"utf8");
describe("K-Vault secret locker service boundaries",()=>{
 it("enforces trusted managed AAL2, catalog and source-owned grants",()=>{
  expect(server).toContain("requireOfficeActor()");
  expect(server).toContain("currentOfficeTrustedDeviceId(current.admin,current.identity.userId)");
  expect(server).toContain('data.company_managed!==true');
  expect(server).toContain('requireOfficeVaultRecord({category:"secrets",recordId:version.document_id,action})');
 });
 it("stores only envelope ciphertext and gates release on independent review and scan",()=>{
  expect(server).toContain("sealVaultContent(data,documentId,versionId,loadVaultKeyring())");
  expect(server).toContain('contentType:"application/octet-stream"');
  expect(server).toContain('version.scan_state!=="CLEAN"||version.review_state!=="APPROVED"');
  expect(server).toContain('openVaultContent(ciphertext,version.document_id,version.id,evidence,loadVaultKeyring())');
 });
 it("does not disclose encryption keys, storage object paths or full source records to browser",()=>{
  expect(server).toContain('select("id,document_id,version_number,uploaded_by,filename,mime_type,byte_size,scan_state,review_state,created_at,reviewed_at")');
  expect(server).not.toContain("NEXT_PUBLIC_OFFICE_VAULT");
  expect(server).toContain('storage.from(BUCKET).upload');
 });
 it("enforces independent confirmation and durable audit before decrypted bytes",()=>{
  expect(server).toContain('version.uploaded_by===current.identity.userId');
  expect(server).toContain('await record(current,version,action==="DOWNLOAD"?"DOWNLOADED":"PREVIEWED")');
 });
 it("queries only authorized secret inventory scopes before emitting metadata",()=>{
  expect(server).toContain('.eq("owner_user_id",current.identity.userId)');
  expect(server).toContain('.in("id",scopedIds.slice(offset,offset+100))');
  expect(server).toContain("const categoryWide=mayRead&&currentGrants.some");
  expect(server).toContain("const unique=new Map<string,SecretDocument>()");
  expect(server).toContain("secretDocumentVisible({");
  expect(server).toContain("secretGrantRights(currentGrants,d.id)");
 });
});
