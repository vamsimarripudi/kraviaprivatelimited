import type {Metadata} from "next";
import {SiteNav} from "@/components/site-nav";
import {Footer} from "@/components/footer";
import {NewsletterAction} from "@/components/newsletter-action";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"KRAVIA newsletter confirm",robots:{index:false,follow:false}};
type Props={searchParams:Promise<{token?:string}>};
export default async function Page({searchParams}:Props){
 const {token}=await searchParams;
 return <><SiteNav/><main id="main-content" className={styles.surface}><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / EMAIL PREFERENCES</p>
  <h1 className={styles.title}>Confirm your subscription.</h1>
  {token&&/^[A-Za-z0-9_-]{40,100}$/.test(token)?<NewsletterAction action="confirm" token={token}/>
    :<p className={styles.message+" "+styles.error}>This link is invalid or incomplete.</p>}
 </div></main><Footer/></>;
}
