import "server-only";
import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";

/** AES-256-GCM envelope encryption. The random per-version content key is
 * wrapped by a separate server-side keyring key, never exposed to clients. */
export type SecretEnvelope={
 ciphertext:Buffer;sha256:string;contentNonce:string;contentTag:string;
 wrappedKey:string;wrapNonce:string;wrapTag:string;keyId:string;
};
export type SecretKeyring={activeId:string;keys:ReadonlyMap<string,Buffer>};
export function loadVaultKeyring(env:NodeJS.ProcessEnv=process.env):SecretKeyring{
 const activeId=(env.OFFICE_VAULT_ACTIVE_KEY_ID||"").trim();
 const raw=env.OFFICE_VAULT_KEYRING_JSON;
 if(!activeId||!raw||activeId.length>60)throw new Error("Server-only K-Vault keyring is not configured");
 let source:unknown;
 try{source=JSON.parse(raw);}catch{throw new Error("K-Vault keyring configuration is invalid");}
 if(!source||typeof source!=="object"||Array.isArray(source))throw new Error("K-Vault keyring configuration is invalid");
 const keys=new Map<string,Buffer>();
 for(const [id,value] of Object.entries(source)){
  if(!/^[a-zA-Z0-9._-]{1,60}$/.test(id)||typeof value!=="string"||
    !/^[A-Za-z0-9+/]{43}=$/.test(value))throw new Error("Invalid keyring entry");
  const bytes=Buffer.from(value,"base64");
  if(bytes.length!==32||bytes.toString("base64")!==value)
    throw new Error("Invalid wrapped-key encryption material");
  keys.set(id,bytes);
 }
 if(!keys.has(activeId))throw new Error("Active K-Vault encryption key is unavailable");
 return {activeId,keys};
}
const aad=(documentId:string,versionId:string)=>
 Buffer.from("KRAVIA-V5-SECRET|"+documentId+"|"+versionId,"utf8");
const decodeHex=(hex:string,bytes:number)=>{
 if(!new RegExp("^[a-f0-9]{"+String(bytes*2)+"}$").test(hex))
  throw new Error("Invalid sealed record evidence");
 return Buffer.from(hex,"hex");
};
function sha(value:Buffer){return createHash("sha256").update(value).digest("hex");}
export function sealVaultContent(
 content:Buffer,documentId:string,versionId:string,keyring:SecretKeyring,
):SecretEnvelope{
 if(content.length<1||content.length>10_485_760)throw new Error("Invalid secret document size");
 const master=keyring.keys.get(keyring.activeId);
 if(!master||master.length!==32)throw new Error("Active encryption key unavailable");
 const key=randomBytes(32),contentNonce=randomBytes(12),wrapNonce=randomBytes(12);
 const context=aad(documentId,versionId);
 const cipher=createCipheriv("aes-256-gcm",key,contentNonce);
 cipher.setAAD(context);
 const ciphertext=Buffer.concat([cipher.update(content),cipher.final()]);
 const contentTag=cipher.getAuthTag();
 const wrapper=createCipheriv("aes-256-gcm",master,wrapNonce);
 wrapper.setAAD(context);
 const wrappedKey=Buffer.concat([wrapper.update(key),wrapper.final()]);
 key.fill(0);
 return {ciphertext,sha256:sha(content),contentNonce:contentNonce.toString("hex"),
  contentTag:contentTag.toString("hex"),wrappedKey:wrappedKey.toString("base64"),
  wrapNonce:wrapNonce.toString("hex"),wrapTag:wrapper.getAuthTag().toString("hex"),
  keyId:keyring.activeId};
}
export type SecretStoredEnvelope={
 key_id:string;wrapped_key:string;wrap_nonce:string;wrap_tag:string;
 content_nonce:string;content_tag:string;sha256:string;byte_size:number;
};
export function openVaultContent(
 ciphertext:Buffer,documentId:string,versionId:string,stored:SecretStoredEnvelope,
 keyring:SecretKeyring,
):Buffer{
 const master=keyring.keys.get(stored.key_id);
 if(!master||master.length!==32)throw new Error("K-Vault key version unavailable");
 const context=aad(documentId,versionId);
 const wrapped=Buffer.from(stored.wrapped_key,"base64");
 if(wrapped.length!==32)throw new Error("Invalid wrapped content key");
 const wrap=createDecipheriv("aes-256-gcm",master,decodeHex(stored.wrap_nonce,12));
 wrap.setAAD(context);wrap.setAuthTag(decodeHex(stored.wrap_tag,16));
 const contentKey=Buffer.concat([wrap.update(wrapped),wrap.final()]);
 try{
  const cipher=createDecipheriv("aes-256-gcm",contentKey,decodeHex(stored.content_nonce,12));
  cipher.setAAD(context);cipher.setAuthTag(decodeHex(stored.content_tag,16));
  const plaintext=Buffer.concat([cipher.update(ciphertext),cipher.final()]);
  if(plaintext.length!==stored.byte_size||sha(plaintext)!==stored.sha256)
   throw new Error("Secret document failed integrity verification");
  return plaintext;
 }finally{contentKey.fill(0);}
}
