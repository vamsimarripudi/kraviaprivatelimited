import type {Metadata} from "next";
import Link from "next/link";
import {SiteNav} from "@/components/site-nav";
import {Footer} from "@/components/footer";
import {currentPublicAccount} from "@/lib/public-access/auth";
import {publicAccessSql} from "@/lib/public-access/db";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"KRAVIA Resources",description:"Approved KRAVIA resource downloads.",alternates:{canonical:"/resources"}};
type Resource={slug:string;title:string;summary:string;byte_size:number;mime_type:string};
async function availableResources():Promise<Resource[]|null>{
 try{const sql=publicAccessSql();const rows=await sql`select slug,title,summary,byte_size,mime_type
 from public_access.resources where status='PUBLISHED' order by published_at desc limit 50`;
 return rows as Resource[];}catch{return null;}
}
export default async function Resources(){
 const [resources,account]=await Promise.all([availableResources(),currentPublicAccount()]);
 return <><SiteNav/><main className={styles.surface} id="main-content"><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / RESOURCE LIBRARY</p><h1 className={styles.title}>Resources worth keeping.</h1>
  <p className={styles.intro}>Browse approved resources without an account. Verify your email only when downloading.</p>
  <div className={styles.actions}><Link className={styles.button+" "+styles.secondary} href={account?"/account":"/join?next=%2Fresources"}>{account?"My account":"Sign in or register"}</Link></div>
  {resources===null?<p className={styles.message} role="status">The catalogue is temporarily unavailable.</p>
  :resources.length===0?<div className={styles.card}><h2>Resource releases are being prepared.</h2><p>No marketing resources are approved for public download yet. Required legal and statutory information remains available without registration.</p></div>
  :<div className={styles.grid}>{resources.map(r=><article className={styles.resource} key={r.slug}>
   <span className={styles.eyebrow}>{r.mime_type.split("/").pop()?.toUpperCase()} · {Math.ceil(r.byte_size/1024)} KB</span>
   <h2>{r.title}</h2><p>{r.summary}</p>
   <a className={styles.button} href={`/api/public-resources/${r.slug}/download`}>Download securely</a>
  </article>)}</div>}
  <p className={styles.notice}>Optional newsletters are never enabled just because you downloaded a file.</p>
 </div></main><Footer/></>;
}
