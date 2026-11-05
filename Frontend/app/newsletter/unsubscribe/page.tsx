import type {Metadata} from "next";
import {SiteNav} from "@/components/site-nav";
import {Footer} from "@/components/footer";
import {NewsletterAction} from "@/components/newsletter-action";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"KRAVIA newsletter preferences",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token}=await searchParams;
 return <><SiteNav/><main className={styles.surface} id="main-content"><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / NEWSLETTER</p>
  <h1 className={styles.title}>Control your inbox.</h1>
  {token&&/^[A-Za-z0-9_-]{40,100}$/.test(token)?<NewsletterAction action="unsubscribe" token={token}/>:
  <p role="alert" className={styles.message+" "+styles.error}>Invalid or incomplete link.</p>}
 </div></main><Footer/></>;
}