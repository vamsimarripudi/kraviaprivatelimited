import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight,BriefcaseBusiness,MapPin } from "lucide-react";
import { getPublicCareerJob } from "@/lib/careers/server";
import styles from "@/components/careers-public.module.css";
export const dynamic="force-dynamic";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {slug}=await params;
  const job=await getPublicCareerJob(slug).catch(()=>null);
  if(!job)return {title:"Job not available | KRAVIA Careers",robots:{index:false}};
  return {title:job.title+" | Careers at KRAVIA",description:job.summary,alternates:{canonical:"/careers/"+slug}};
}
export default async function CareerJobPage({params}:Props){
  const {slug}=await params;
  const job=await getPublicCareerJob(slug).catch(()=>null);
  if(!job)notFound();
  const structured={
    "@context":"https://schema.org","@type":"JobPosting",
    title:job.title,description:[job.description,job.requirements,job.benefits].filter(Boolean).join("\n\n"),
    datePosted:job.publishedAt.slice(0,10),
    ...(job.expiresAt?{validThrough:job.expiresAt}:{}),
    employmentType:job.employmentType,
    hiringOrganization:{"@type":"Organization",name:"KRAVIA PRIVATE LIMITED",sameAs:"https://kraviaprivatelimited.com"},
    ...(job.workMode==="REMOTE"?{jobLocationType:"TELECOMMUTE",applicantLocationRequirements:{"@type":"Country",name:"India"}}:
      {jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressCountry:"IN",addressLocality:job.location}}}),
    directApply:true,url:"https://kraviaprivatelimited.com/careers/"+job.slug,
  };
  return <main id="main-content" className={styles.shell+" shell"}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,"\\u003c")}}/>
    <div className={styles.topline}><Link href="/careers" className={styles.back}>All openings</Link><Link href="/careers/application" className={styles.back}>Track application</Link></div>
    <p className={styles.kicker}>KRAVIA CAREERS / {job.department}</p>
    <h1 className={styles.heading}>{job.title}</h1>
    <p className={styles.lead}>{job.summary}</p>
    <div className={styles.meta} style={{marginBottom:22}}>
      <span className={styles.pill}><BriefcaseBusiness size={14}/> {job.employmentType}</span>
      <span className={styles.pill}>{job.workMode}</span>
      <span className={styles.pill}><MapPin size={14}/> {job.location}</span>
      <span className={styles.pill}>{job.openings} opening(s)</span>
    </div>
    <div className={styles.detail}>
      <h2>Responsibilities and role</h2><p>{job.description}</p>
      {job.requirements?<><h2>Requirements</h2><p>{job.requirements}</p></>:null}
      {job.benefits?<><h2>Employment conditions and benefits</h2><p>{job.benefits}</p></>:null}
      {job.expiresAt?<p className={styles.minor}>Application deadline: {new Date(job.expiresAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"})} IST</p>:null}
      <div className={styles.actions}>
        <Link className={styles.button} href={"/careers/"+job.slug+"/apply"}>Apply securely <ArrowRight size={16}/></Link>
        <Link className={styles.buttonAlt} href="/careers">Browse other openings</Link>
      </div>
      <p className={styles.minor}>This listing comes from an approved, currently open requisition. The official job offer and salary conditions will be governed separately by HR.</p>
    </div>
  </main>;
}
