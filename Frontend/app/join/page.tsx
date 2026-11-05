import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { Footer } from "@/components/footer";
import { PublicAccessForm } from "@/components/public-access-form";
import { safePublicReturnPath } from "@/lib/public-access/return-path";
import styles from "@/components/public-access.module.css";

type Props={searchParams:Promise<{next?:string}>};
export const metadata:Metadata={title:"Sign in or register | KRAVIA resources",
  description:"Secure public access to approved KRAVIA resources.",robots:{index:false,follow:false}};
export default async function Join({searchParams}:Props){
  const params=await searchParams;
  return <><SiteNav/><main id="main-content" className={styles.surface}><div className={styles.shell}>
    <p className={styles.eyebrow}>KRAVIA / PUBLIC ACCESS</p>
    <h1 className={styles.title}>Welcome. Continue securely.</h1>
    <p className={styles.intro}>Create a free visitor account or sign in using your email address. KRAVIA Office remains reserved for authorised company personnel.</p>
    <PublicAccessForm returnPath={safePublicReturnPath(params.next)}/>
  </div></main><Footer/></>;
}
