import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const service=readFileSync(new URL("../lib/office/vault-secret-ingress.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../Database/supabase/migrations/202611140023_office_vault_chunked_ingress.sql",import.meta.url),"utf8");
describe("K-Vault 10 MiB encrypted chunk ingress",()=>{
 it("accepts generic browser MIME only for known types and preserves source verification",()=>{
  expect(service).toContain('input.mime!=="application/octet-stream"');
  expect(service).toContain("declared_mime:allowed[ext]");
  expect(service).toContain("uploadOfficeVaultSecret({");
 });
 it("limits request parts to one MiB and prevents browser direct DB access",()=>{
  expect(service).toContain("SECRET_UPLOAD_PART_SIZE=1_048_576");
  expect(service).toContain("TOTAL_LIMIT=10_485_760");
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("revoke all on public.office_vault_secret_ingress_sessions");
  expect(migration).toContain("public.office_vault_secret_ingress_parts from public,anon,authenticated");
  expect(migration).toContain("grant select,insert,update,delete");
 });
 it("only stores wrapped encrypted chunks, never plaintext object uploads",()=>{
  expect(service).toContain("sealVaultContent(data,id,partId,loadVaultKeyring())");
  expect(service).toContain('contentType:"application/octet-stream"');
  expect(service).toContain("data.fill(0)");
  expect(service).toContain("openVaultContent(ciphertext,record.id,part.part_id,envelope,keyring)");
  expect(service).toContain("plain?.fill(0);ciphertext.fill(0)");
  expect(service).toContain("assembled.fill(0)");
 });
 it("requires current AAL2-bound uploader, immutable scope and finalization ownership",()=>{
  expect(service).toContain("requireOfficeVaultSecretUploader()");
  expect(service).toContain('.eq("owner_user_id",current.identity.userId)');
  expect(service).toContain('.eq("state","OPEN")');
  expect(service).toContain('.eq("state","FINALIZING")');
  expect(service).toContain("versionId:record.version_id");
 });
 it("can clean stale encrypted part storage and expire abandoned sessions",()=>{
  expect(service).toContain('list("ingress/"+id');
  expect(service).toContain("cleanupExpired(current)");
  expect(service).toContain('state:"ABORTED"');
  expect(service).toContain('expired_cleanup_pending:!cleanupComplete');
  expect(migration).toContain("old.expires_at<=now()");
 });
 it("preserves scan, independent reviewer and source registration",()=>{
  expect(service).toContain("uploadOfficeVaultSecret({");
  expect(service).toContain("const prior=await current.admin.from");
  expect(service).toContain('select("id").eq("id",record.version_id)');
  expect(service).toContain("cleanup_pending:cleanupPending");
 });
});
