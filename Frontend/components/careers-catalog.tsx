"use client";
import Link from "next/link";
import { useMemo,useState } from "react";
import { ArrowUpRight,BriefcaseBusiness,MapPin,Search } from "lucide-react";
import styles from "./careers-public.module.css";
export type PublicCareerJob={
  id:string;slug:string;title:string;summary:string;description:string;
  requirements:string;benefits:string;department:string;
  employmentType:string;workMode:string;location:string;
  openings:number;expiresAt:string|null;
};
export function CareersCatalog({jobs}:{jobs:PublicCareerJob[]}) {
  const [query,setQuery]=useState("");
  const [department,setDepartment]=useState("ALL");
  const departments=useMemo(()=>Array.from(new Set(jobs.map(j=>j.department))).sort(),[jobs]);
  const results=useMemo(()=>jobs.filter(job=>
    (department==="ALL"||job.department===department)
    && (job.title+" "+job.summary+" "+job.location+" "+job.department).toLowerCase().includes(query.toLowerCase().trim())
  ),[jobs,department,query]);
  if(!jobs.length)return <div className={styles.state}>
    <BriefcaseBusiness size={27} color="#6177ad"/>
    <h2>No approved roles are currently open</h2>
    <p>KRAVIA publishes only verified, approved vacancies. You can revisit this page later or contact the recruitment team for general enquiries.</p>
  </div>;
  return <>
    <div className={styles.toolbar}>
      <label><span>Search roles</span><div style={{display:"flex",alignItems:"center",gap:7}}>
        <Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Position, location or team" aria-label="Search careers"/>
      </div></label>
      <label><span>Department</span>
        <select value={department} onChange={e=>setDepartment(e.target.value)}>
          <option value="ALL">All departments</option>
          {departments.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </label>
    </div>
    <div className={styles.grid}>
      {results.map(job=><article key={job.id} className={styles.card}>
        <div className={styles.meta}>
          <span className={styles.pill}>{job.department}</span>
          <span className={styles.pill}>{job.workMode}</span>
          <span className={styles.pill}>{job.employmentType}</span>
        </div>
        <h2>{job.title}</h2>
        <p>{job.summary}</p>
        <div className={styles.meta}><MapPin size={15}/>{job.location} · {job.openings} available opening(s)</div>
        <Link className={styles.button} href={"/careers/"+job.slug}>View role and apply <ArrowUpRight size={15}/></Link>
      </article>)}
    </div>
    {!results.length?<div className={styles.state}><h2>No matching roles</h2><p>Adjust your search or department filter.</p></div>:null}
  </>;
}
