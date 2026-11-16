import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/motion";
import { CareersCatalog } from "@/components/careers-catalog";
import { listPublicCareerJobs } from "@/lib/careers/server";
import { publicPages } from "@/lib/site";
import { publicCorporateEmails } from "@/lib/corporate/public-email-directory";
import styles from "@/components/careers-public.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Careers at KRAVIA PRIVATE LIMITED | Verified openings",
  description:"Explore independently approved opportunities with KRAVIA. All hiring positions are published only after company approval.",
  alternates:{canonical:"/careers"},
};
export default async function CareersPage() {
  let jobs:Awaited<ReturnType<typeof listPublicCareerJobs>>|null=null;
  try{jobs=await listPublicCareerJobs();}catch{jobs=null;}
  return <main id="main-content"><PageHero {...publicPages.careers}/>
    <section className={styles.shell+" shell"}>
      <div className={styles.topline}><div>
        <p className={styles.kicker}>JOIN THE COMPANY</p>
        <h2 className={styles.heading}>Open and approved opportunities</h2>
        <p className={styles.lead}>Roles are published only after internal headcount and hiring authorization. Applications remain private and require email verification before HR assessment.</p>
      </div><Link href="/careers/application" className={styles.buttonAlt}>Track my application</Link></div>
      {jobs===null?<div className={styles.state} role="status"><h2>Listings temporarily unavailable</h2><p>KRAVIA cannot verify currently approved openings. Please return later rather than relying on outdated role information.</p></div>
        :<CareersCatalog jobs={jobs}/>}
      <p className={styles.minor} style={{marginTop:24}}>General recruiting correspondence: <a href={"mailto:"+publicCorporateEmails.careers} className={styles.back}>{publicCorporateEmails.careers}</a>. Do not email identity or banking documents.</p>
    </section>
  </main>;
}
