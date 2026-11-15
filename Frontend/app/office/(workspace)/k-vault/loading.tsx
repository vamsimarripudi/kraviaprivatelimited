import {FileLock2,ShieldCheck} from "lucide-react";

/** No record existence, count or filename is guessed while source grants load. */
export default function VaultLoading() {
 return <section className="office-vault-loading" role="status" aria-busy="true" aria-label="Opening authorized K-Vault">
  <div className="office-vault-loading-heading">
   <span><FileLock2 size={23}/></span>
   <div><strong>Opening K-Vault</strong><p>Verifying your current document and access permissions…</p></div>
   <ShieldCheck size={20}/>
  </div>
  <div className="office-vault-loading-tiles" aria-hidden="true">
   <div/><div/><div/><div/>
  </div>
  <div className="office-vault-loading-table" aria-hidden="true"><i/><i/><i/><i/></div>
 </section>;
}
