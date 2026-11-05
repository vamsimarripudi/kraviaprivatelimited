import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { Footer } from "@/components/footer";
import { currentPublicAccount } from "@/lib/public-access/auth";
import { publicAccessSql } from "@/lib/public-access/db";
import { PublicAccountControls } from "@/components/public-account-controls";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Your public account | KRAVIA",robots:{index:false,follow:false}};
type Event={resource_slug:string;title:string;requested_at:string};
export default async function Account(){
 const account=await currentPublicAccount();
 let events:Event[]=[];
 if(account)try{
  const sql=publicAccessSql();
  events=await sql`select d.resource_slug,r.title,d.requested_at from public_access.download_events d
    join public_access.resources r on r.slug=d.resource_slug
    where d.account_id=${account.id}::uuid order by d.requested_at desc limit 15` as Event[];
 }catch{/* Fail closed without showing private history. */}
 return <><SiteNav/><main className={styles.surface} id="main-content"><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / MY ACCOUNT</p>
  <h1 className={styles.title}>Your public access.</h1>
  {!account?<div className={styles.card}><p>Sign in to view your verified email, newsletter settings and download history.</p><Link href="/join?next=%2Faccount" className={styles.button}>Sign in or register</Link></div>
  :<><div className={styles.card}><h2>Profile</h2><p><strong>Name:</strong> {account.displayName}</p><p><strong>Verified email:</strong> {account.email}</p>
   <p className={styles.mini}>This public visitor profile does not grant KRAVIA Office access.</p></div>
   <PublicAccountControls status={account.newsletterStatus}/>
   <div className={styles.card}><h2>Recent downloads</h2>
    {events.length?<ul>{events.map((event,i)=><li key={i}>{event.title} — {new Date(event.requested_at).toLocaleDateString("en-IN")}</li>)}</ul>:<p>No downloads recorded yet.</p>}
    <Link href="/resources" className={styles.link}>Browse approved resources</Link>
   </div>
   <p className={styles.notice}>For correction, erasure or other privacy requests, use the <Link href="/privacy-request" className={styles.link}>privacy request portal</Link>.</p>
  </>}
 </div></main><Footer/></>;
}
