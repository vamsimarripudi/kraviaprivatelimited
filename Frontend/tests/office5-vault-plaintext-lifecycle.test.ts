import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {loadVaultKeyring,openVaultContent,sealVaultContent} from "../lib/office/vault-secret-crypto";
const service=readFileSync(new URL("../lib/office/vault-secret-server.ts",import.meta.url),"utf8");
const crypto=readFileSync(new URL("../lib/office/vault-secret-crypto.ts",import.meta.url),"utf8");
const doc="00000000-0000-4000-8000-000000000001";
const v="00000000-0000-4000-8000-000000000002";
describe("K-Vault plaintext lifecycle hygiene",()=>{
 it("wipes upload and scan retry plaintext on errors and success",()=>{
  expect(service).toMatch(/uploadOfficeVaultSecret[\s\S]*?const data=Buffer.from\(await input.file.arrayBuffer\(\)\);[\s\S]*?try\{[\s\S]*?finally\{data.fill\(0\);\}/);
  expect(service).toMatch(/retryOfficeVaultSecretScan[\s\S]*?const data=await decryptStored\(current,version\);[\s\S]*?try\{[\s\S]*?finally\{data.fill\(0\);\}/);
 });
 it("wipes decrypted bytes on failed audit before response ownership transfer",()=>{
  expect(service).toContain("if(!transferred)bytes.fill(0)");
  expect(service).toContain('await record(current,version,action==="DOWNLOAD"?"DOWNLOADED":"PREVIEWED")');
 });
 it("rejects a tampered cleartext hash with an integrity error",()=>{
  const keyring=loadVaultKeyring({OFFICE_VAULT_ACTIVE_KEY_ID:"test",
   OFFICE_VAULT_KEYRING_JSON:JSON.stringify({test:randomBytes(32).toString("base64")})});
  const original=Buffer.from("private evidence for test");
  const envelope=sealVaultContent(original,doc,v,keyring);
  const saved={key_id:envelope.keyId,wrapped_key:envelope.wrappedKey,
    wrap_nonce:envelope.wrapNonce,wrap_tag:envelope.wrapTag,
    content_nonce:envelope.contentNonce,content_tag:envelope.contentTag,
    sha256:"0".repeat(64),byte_size:original.length};
  expect(()=>openVaultContent(envelope.ciphertext,doc,v,saved,keyring)).toThrow("Secret document failed integrity verification");
  expect(crypto).toContain("plaintext.fill(0)");
 });
});
