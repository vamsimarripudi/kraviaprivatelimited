import type {Metadata} from "next";
import {SiteNav} from "@/components/site-nav";
import {Footer} from "@/components/footer";
import {PublicAccessForm} from "@/components/public-access-form";
import {safePublicReturnPath} from "@/lib/public-access/auth";
import styles from "@/components/public-access.module.css";
export const metadata:Metadata={title:"Sign in or register | KRAVIA",robots:{index:false,follow:false}};
export default async function Join({searchParams}:{searchParams:Promise<{next?:string}>}){
 const {next}=await searchParams;
 return <><SiteNav/><main className={styles.surface} id="main-content"><div className={styles.shell}>
  <p className={styles.eyebrow}>KRAVIA / PUBLIC ACCESS</p><h1 className={styles.title}>Sign in or create an account.</h1>
  <p className={styles.intro}>Verify your email to download approved KRAVIA resources. This public account does not provide KRAVIA Office access.</p>
  <PublicAccessForm returnPath={safePublicReturnPath(next)}/>
 </div></main><Footer/></>;
}
