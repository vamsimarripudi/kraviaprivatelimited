import {describe,it,expect} from "vitest";
import {randomBytes} from "node:crypto";
import {loadVaultKeyring,openVaultContent,sealVaultContent} from "../lib/office/vault-secret-crypto";
const doc="00000000-0000-4000-8000-000000000001";
const version="00000000-0000-4000-8000-000000000002";
const env={OFFICE_VAULT_ACTIVE_KEY_ID:"test-k1",
 OFFICE_VAULT_KEYRING_JSON:JSON.stringify({"test-k1":randomBytes(32).toString("base64")})};
describe("K-Vault envelope encryption",()=>{
 it("round trips an authenticated unique per-version key and plaintext hash",()=>{
  const keys=loadVaultKeyring(env);
  const data=Buffer.from("%PDF-1.6\\nprivate invoice contents");
  const envelope=sealVaultContent(data,doc,version,keys);
  expect(envelope.ciphertext.equals(data)).toBe(false);
  const record={key_id:envelope.keyId,wrapped_key:envelope.wrappedKey,
   wrap_nonce:envelope.wrapNonce,wrap_tag:envelope.wrapTag,
   content_nonce:envelope.contentNonce,content_tag:envelope.contentTag,
   sha256:envelope.sha256,byte_size:data.length};
  expect(openVaultContent(envelope.ciphertext,doc,version,record,keys)).toEqual(data);
  expect(()=>openVaultContent(envelope.ciphertext,doc,"00000000-0000-4000-8000-000000000009",record,keys)).toThrow();
  const altered=Buffer.from(envelope.ciphertext);altered[0]^=1;
  expect(()=>openVaultContent(altered,doc,version,record,keys)).toThrow();
 });
 it("rejects missing or malformed server-held encryption keys",()=>{
  expect(()=>loadVaultKeyring({})).toThrow();
  expect(()=>loadVaultKeyring({OFFICE_VAULT_ACTIVE_KEY_ID:"test-k1",
   OFFICE_VAULT_KEYRING_JSON:'{"test-k1":"not-a-key"}'})).toThrow();
 });
});
