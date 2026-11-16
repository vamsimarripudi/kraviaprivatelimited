import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {getPublicCareerJob} from "@/lib/careers/server";
import {CareerApplicationForm} from "@/components/career-application-form";
import styles from "@/components/careers-public.module.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Apply securely | KRAVIA Careers",
  description:"Private, email-verified job applications for approved KRAVIA roles.",
  robots:{index:false,follow:false},
};
export default async function Apply({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const job=await getPublicCareerJob(slug).catch(()=>null);
  if(!job)notFound();
  return <main id="main-content" className={styles.shell+" shell"}>
    <div className={styles.topline}><Link className={styles.back} href={"/careers/"+slug}>Back to job details</Link><Link className={styles.back} href="/careers/application">Existing application</Link></div>
    <CareerApplicationForm jobSlug={job.slug} jobTitle={job.title}/>
  </main>;
}
