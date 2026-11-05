import type {Metadata} from "next";
import Link from "next/link";
import {SiteNav} from "@/components/site-nav";
import {Footer} from "@/components/footer";
import {currentPublicAccount} from "@/lib/public-access/auth";
import {publicAccessSql} from "@/lib/public-access/db";
import {PublicAccountControls} from "@/components/public-account-controls";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My KRAVIA account",robots:{index:false,follow:false}};
type Event={title:string;requested_at:string};
export default async function Account(){
 const account=await currentPublicAccount();let events:Event[]=[];
 if(account)try{const sql=publicAccessSql();events=await sql`select r.title,d.requested_at
  from public_access.download_events d join public_access.resources r on r.slug=d.resource_slug
  where d.account_id=${account.id}::uuid order by d.requested_at desc limit 15` as Event[];}catch{/* private history unavailable */}
 return <><SiteNav/><main className={styles.surface} id="main-content"><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / MY ACCOUNT</p><h1 className={styles.title}>Your account.</h1>
  {!account?<div className={styles.card}><p>Sign in to view your profile and preferences.</p><Link href="/join?next=%2Faccount" className={styles.button}>Sign in or register</Link></div>:
  <><div className={styles.card}><h2>Profile</h2><p><strong>{account.displayName}</strong></p><p>{account.email}</p><p>This account does not have KRAVIA Office access.</p></div>
   <PublicAccountControls status={account.newsletterStatus}/>
   <div className={styles.card}><h2>Recent downloads</h2>
    {events.length?<ul className={styles.list}>{events.map((e,i)=><li key={i}>{e.title} — {new Date(e.requested_at).toLocaleDateString("en-IN")}</li>)}</ul>:<p>No downloads recorded.</p>}
    <Link href="/resources" className={styles.link}>Browse resources</Link></div>
   <p className={styles.notice}>For correction or deletion of personal data, use the <Link className={styles.link} href="/privacy-request">privacy request portal</Link>.</p>
  </>}
 </div></main><Footer/></>;
}
