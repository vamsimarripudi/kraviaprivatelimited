import { notFound } from "next/navigation";
import { OfficeWorkspaceShell } from "@/components/office-workspace-shell";
import { PublicResourcePublisher } from "@/components/public-resource-publisher";
import { requireWorkspaceIdentity } from "@/lib/office/guard";
import { publicAccessSql } from "@/lib/public-access/db";
import styles from "@/components/public-access.module.css";
export const dynamic="force-dynamic";
export default async function OwnerResourcePublishing(){
 const identity=await requireWorkspaceIdentity("office","/office/resource-publishing");
 if(!identity.roles.includes("OWNER"))notFound();
 let rows:{slug:string;title:string;summary:string;file_name:string;byte_size:number;status:string;checksum_sha256:string}[]=[];
 let ready=true;
 try {
  const sql=publicAccessSql();
  rows=await sql`select slug,title,summary,file_name,byte_size,status,checksum_sha256
    from public_access.resources order by created_at desc limit 100` as typeof rows;
 }catch{ready=false;}
 return <OfficeWorkspaceShell workspace="office" identity={identity} permissions={[]}>
  <section className={styles.surface}><div className={styles.shell}>
   <p className={styles.eyebrow}>OWNER ONLY / PUBLIC CONTENT</p>
   <h2 className={styles.title}>Resource publishing</h2>
   <p className={styles.intro}>Publish public, reviewed materials without exposing corporate Office records. Visitor accounts belong to an isolated public-access system.</p>
   {ready?<PublicResourcePublisher initial={rows}/>:<p role="alert" className={styles.message+" "+styles.error}>Dedicated public-access database is not configured. Uploads and publication are disabled.</p>}
  </div></section>
 </OfficeWorkspaceShell>;
}
