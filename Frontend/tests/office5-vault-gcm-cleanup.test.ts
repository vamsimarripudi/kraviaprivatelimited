import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {loadVaultKeyring,sealVaultContent,openVaultContent} from "../lib/office/vault-secret-crypto";
const source=readFileSync(new URL("../lib/office/vault-secret-crypto.ts",import.meta.url),"utf8");
const doc="00000000-0000-4000-8000-000000000001";
const v="00000000-0000-4000-8000-000000000002";
describe("Vault GCM partial plaintext and key cleanup",()=>{
 const keyring=loadVaultKeyring({OFFICE_VAULT_ACTIVE_KEY_ID:"test",
  OFFICE_VAULT_KEYRING_JSON:JSON.stringify({test:randomBytes(32).toString("base64")})});
 const plain=Buffer.from("sensitive original evidence");
 const e=sealVaultContent(plain,doc,v,keyring);
 const entry={key_id:e.keyId,wrapped_key:e.wrappedKey,wrap_nonce:e.wrapNonce,
  wrap_tag:e.wrapTag,content_nonce:e.contentNonce,content_tag:e.contentTag,
  sha256:e.sha256,byte_size:plain.length};
 it("rejects forged ciphertext and wrapped key authentication tags",()=>{
  const bad=Buffer.from(e.ciphertext);bad[0]^=1;
  expect(()=>openVaultContent(bad,doc,v,entry,keyring)).toThrow();
  const wrongWrap={...entry,wrap_tag:"00".repeat(16)};
  expect(()=>openVaultContent(e.ciphertext,doc,v,wrongWrap,keyring)).toThrow();
 });
 it("zeroizes intermediate GCM output even if final authentication fails",()=>{
  expect(source).toContain("const initial=decipher.update(encrypted)");
  expect(source).toContain("finally{initial.fill(0);}");
  expect(source).toContain("finally{trailing.fill(0);}");
  expect(source).toContain("const contentKey=decryptAuthenticated(wrap,wrapped)");
  expect(source).toContain("const plaintext=decryptAuthenticated(cipher,ciphertext)");
 });
 it("zeroizes ephemeral content keys when encryption fails",()=>{
  expect(source).toContain("finally{key.fill(0);}");
  expect(source).toContain("finally{contentKey.fill(0);}");
 });
});
