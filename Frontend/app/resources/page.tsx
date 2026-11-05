import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { Footer } from "@/components/footer";
import { currentPublicAccount } from "@/lib/public-access/auth";
import { publicAccessSql } from "@/lib/public-access/db";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"KRAVIA resource library",description:"Approved guides, media and practical resources from KRAVIA.",alternates:{canonical:"/resources"}};
type Resource={slug:string;title:string;summary:string;file_name:string;byte_size:number;mime_type:string};
async function publishedResources():Promise<{items:Resource[];available:boolean}>{
 try {
  const sql=publicAccessSql();
  const rows=await sql`select slug,title,summary,file_name,byte_size,mime_type from public_access.resources
    where status='PUBLISHED' order by published_at desc,slug asc limit 50`;
  return {items:rows as Resource[],available:true};
 } catch { return {items:[],available:false}; }
}
export default async function Resources(){
 const [data,account]=await Promise.all([publishedResources(),currentPublicAccount()]);
 return <><SiteNav/><main className={styles.surface} id="main-content"><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / RESOURCE LIBRARY</p>
  <h1 className={styles.title}>Resources worth keeping.</h1>
  <p className={styles.intro}>Approved company guides and practical materials, in one place. Browse freely; verify your email only when downloading a resource.</p>
  <div className={styles.actions}><Link className={styles.button+" "+styles.ghost} href={account?"/account":"/join?next=%2Fresources"}>{account?"My account":"Sign in or register"}</Link></div>
  {!data.available?<p role="status" className={styles.message}>The resource catalogue is temporarily unavailable. No download is being offered.</p>
    :!data.items.length?<p role="status" className={styles.card}>No public resource files have been approved for release yet. Newsroom, company information and legal notices remain available without registration.</p>
    :<div className={styles.grid}>{data.items.map(resource=><article className={styles.resource} key={resource.slug}>
      <p className={styles.tag}>{resource.mime_type.split("/").pop()?.toUpperCase()} · {Math.max(1,Math.ceil(resource.byte_size/1024))} KB</p>
      <h2>{resource.title}</h2><p>{resource.summary}</p>
      <a className={styles.button} href={`/api/public-resources/${resource.slug}/download`}>Download securely</a>
    </article>)}</div>}
  <p className={styles.notice}>Public statutory and privacy disclosures are not gated. You will never be enrolled in newsletters merely because you downloaded a file.</p>
 </div></main><Footer/></>;
}
