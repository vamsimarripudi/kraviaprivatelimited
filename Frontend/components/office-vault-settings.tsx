import "server-only";
import Link from "next/link";
import {ArrowRight,LockKeyhole,ShieldCheck,FileCheck2} from "lucide-react";
import {requireOfficeActor,resolveOfficePermission} from "@/lib/office/permission-engine";
import {currentOfficeTrustedDeviceId} from "@/lib/office/device-binding-server";
import {getOfficeVaultAccessCenter} from "@/lib/office/vault-access-server";
import styles from "./office-vault-settings.module.css";
const sources=[
 {code:"privacy.retention.read",title:"Retention rules",description:"Review current legal and privacy retention obligations",href:"/office/privacy"},
 {code:"access.audit.read",title:"Access audit",description:"Investigate authorized access events and changes",href:"/office/audit"},
 {code:"custody.review",title:"Custody verification",description:"Review physical originals and custody evidence",href:"/office/custody"},
 {code:"document.instance.review",title:"Document review",description:"Open source-controlled document verification",href:"/office/documents"},
 {code:"registration.review",title:"Registration review",description:"Verify company filings and certificates",href:"/office/registrations"},
] as const;
export async function OfficeVaultSettings(){
 const current=await requireOfficeActor();
 const device=await currentOfficeTrustedDeviceId(current.admin,current.identity.userId);
 const admin=await resolveOfficePermission(current.admin,current.identity,"access.profile.assign",{type:"COMPANY"},device);
 if(!admin.allowed)return <section className={styles.denied} role="status">
   <LockKeyhole size={26} aria-hidden="true"/><h2>Vault policy administration is restricted</h2>
   <p>Your current effective authority cannot manage this policy area.</p>
   <Link href="/office/k-vault/requests">Request governed access</Link>
  </section>;
 const checks=await Promise.all(sources.map(async source=>({
  ...source,allowed:(await resolveOfficePermission(current.admin,current.identity,
   source.code,{type:"COMPANY"},device)).allowed
 })));
 const center=await getOfficeVaultAccessCenter();
 const now=Date.parse(center.generated_at);
 const grantCount=center.administered_grants.filter(g=>!g.revoked_at&&Date.parse(g.expires_at)>now).length;
 const pending=center.review_queue.filter(q=>q.requester_user_id!==center.actor_user_id).length;
 return <section className={styles.settings} aria-label="K-Vault policy administration">
  <header><p className={styles.eyebrow}>K-VAULT · GOVERNED POLICY</p>
   <h2>Classification, access and retention</h2>
   <p>Live policy links and effective grants. The vault is a secured index; it does not duplicate the legal source policy editor.</p></header>
  <div className={styles.metrics}>
   <article><span>Accessible policy sources</span><strong>{checks.filter(x=>x.allowed).length}</strong></article>
   <article><span>Active governed grants</span><strong>{grantCount}</strong></article>
   <article><span>Pending independent reviews</span><strong>{pending}</strong></article>
  </div>
  <h3>Canonical policy controls</h3>
  <div className={styles.cards}>
   {checks.map(item=><article key={item.code}>
    {item.allowed?<FileCheck2 size={22} aria-hidden="true"/>:<LockKeyhole size={22} aria-hidden="true"/>}
    <div><h4>{item.title}</h4><p>{item.description}</p>
     <small>{item.allowed?"Current effective capability confirmed":"Not assigned for your active identity"}</small></div>
    {item.allowed?<Link href={item.href}>Open source <ArrowRight size={15}/></Link>:null}
   </article>)}
  </div>
  <section className={styles.boundary}><ShieldCheck size={22} aria-hidden="true"/><div>
   <h3>Policy change boundary</h3>
   <p>Source classification, retention holds, effective access dates, approval separation and document signing rules are enforced by their authoritative systems. Vault settings cannot bypass them or silently publish changes.</p>
   <Link href="/office/k-vault/access">Review scoped Vault access <ArrowRight size={16}/></Link>
  </div></section>
 </section>;
}
