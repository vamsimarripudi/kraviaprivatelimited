import {describe,it,expect} from "vitest";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {loadVaultKeyring,sealVaultContent,openVaultContent} from "../lib/office/vault-secret-crypto";
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
describe("10MiB multi-part authenticated envelope reconstruction",()=>{
 it("reassembles all 10 one-MiB chunks without plaintext staging and rejects corrupt GCM",()=>{
  const master=loadVaultKeyring({OFFICE_VAULT_ACTIVE_KEY_ID:"ci-test",
   OFFICE_VAULT_KEYRING_JSON:JSON.stringify({"ci-test":randomBytes(32).toString("base64")})});
  const src=randomBytes(10*1024*1024);
  const reconstructed=Buffer.alloc(src.length);
  const session=randomUUID();
  let offset=0;
  for(let i=0;i<10;i++){
   const partId=randomUUID();
   const input=Buffer.from(src.subarray(i*1048576,(i+1)*1048576));
   const envelope=sealVaultContent(input,session,partId,master);
   const stored={key_id:envelope.keyId,wrapped_key:envelope.wrappedKey,
    wrap_nonce:envelope.wrapNonce,wrap_tag:envelope.wrapTag,
    content_nonce:envelope.contentNonce,content_tag:envelope.contentTag,
    sha256:envelope.sha256,byte_size:input.length};
   const output=openVaultContent(envelope.ciphertext,session,partId,stored,master);
   output.copy(reconstructed,offset);
   offset+=output.length;
   output.fill(0);
   const forged=Buffer.from(envelope.ciphertext);
   forged[0]^=0xff;
   expect(()=>openVaultContent(forged,session,partId,stored,master)).toThrow();
   input.fill(0);forged.fill(0);envelope.ciphertext.fill(0);
  }
  expect(offset).toBe(src.length);
  expect(digest(reconstructed)).toBe(digest(src));
  src.fill(0);reconstructed.fill(0);
 });
});
