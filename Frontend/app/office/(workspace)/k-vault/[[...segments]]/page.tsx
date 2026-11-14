import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileLock2, LockKeyhole, ShieldCheck } from "lucide-react";
import { getOfficeVaultAccess } from "@/lib/office/vault-server";
import { getOfficeRegistrationOverview } from "@/lib/office/registration-server";
import { getOfficeDocumentStudioOverview } from "@/lib/office/document-studio-server";
import { getSecureCustodyOverview } from "@/lib/office/custody-server";
import { InternalWorkspaceScreen } from "@/components/internal-workspace-screen";
import { OfficeVaultAccessCenter } from "@/components/office-vault-access-center";
import {OfficeVaultCategoryBrowser} from "@/components/office-vault-category-browser";
import {OfficeVaultCompanyMaster} from "@/components/office-vault-company-master";
import {OfficeVaultDocumentDirectory,type VaultDocumentSummary} from "@/components/office-vault-document-directory";
import {OfficeVaultSettings} from "@/components/office-vault-settings";
import { OfficeVaultOverview } from "@/components/office-vault-overview";
import { OfficeVaultActivity } from "@/components/office-vault-activity";
import { OfficeVaultVerificationQueue } from "@/components/office-vault-verification-queue";
import { requireOfficeVaultRecord, getOfficeVaultGrantedResources, getOfficeVaultAllowedActions, getOfficeVaultSourceVisibleRecordIds, OfficeVaultAccessError } from "@/lib/office/vault-access-server";
import styles from "@/components/office-vault.module.css";


function AccessEmpty({category}:{category:string}){
 return <div className={styles.sourceCard}><LockKeyhole size={24}/>
  <div><h2>No granted {category} records</h2>
   <p>Only active explicitly granted records are listed. The category being visible does not reveal individual record existence.</p>
   <Link href="/office/k-vault/requests">Request scoped access <ArrowRight size={16}/></Link>
  </div></div>;
}
async function RegisteredRecords({category}:{category:"identity"|"registrations"}){
 const grants=await getOfficeVaultGrantedResources(category);
 if(!grants.length)return <AccessEmpty category="registration"/>;
 const data=await getOfficeRegistrationOverview();
 const sourceVisible=await getOfficeVaultSourceVisibleRecordIds(category,data.registrations);
 const allowed=data.registrations.filter(row=>sourceVisible.has(row.id)&&
  (grants.includes(null)||grants.includes(row.id)));
 if(!allowed.length)return <AccessEmpty category="registration"/>;
 return <div className={styles.categories}>{allowed.map(row=><Link className={styles.category}
   href={"/office/k-vault/records/"+row.id} key={row.id}><ShieldCheck size={20}/>
   <span><strong>{row.title}</strong><small>{row.registration_type} · {row.identifier_masked} · {row.status}</small></span>
   <ArrowRight size={16}/></Link>)}</div>;
}
async function GrantedDocuments(){
 const grants=await getOfficeVaultGrantedResources("documents");
 if(!grants.length)return <AccessEmpty category="document"/>;
 const data=await getOfficeDocumentStudioOverview();
 const sourceVisible=await getOfficeVaultSourceVisibleRecordIds("documents",data.instances);
 const docs=data.instances.filter(row=>sourceVisible.has(row.id)&&
  (grants.includes(null)||grants.includes(row.id)));
 const rows:VaultDocumentSummary[]=docs.map(row=>({
  id:row.id,title:row.title,code:row.document_code,
  classification:row.classification,status:row.status,
  createdAt:row.created_at,
  outputCount:data.renders.filter(render=>render.document_instance_id===row.id&&
   ["GENERATED","SIGNED"].includes(render.status)).length,
 }));
 return <OfficeVaultDocumentDirectory records={rows}/>;
}
async function GrantedCustody(){
 const grants=await getOfficeVaultGrantedResources("custody");
 if(!grants.length)return <AccessEmpty category="custody"/>;
 const data=await getSecureCustodyOverview();
 const sourceVisible=await getOfficeVaultSourceVisibleRecordIds("custody",
  data.items.map(row=>({id:row.id,owner_user_id:row.current_custodian_user_id})));
 const records=data.items.filter(row=>sourceVisible.has(row.id)&&
  (grants.includes(null)||grants.includes(row.id)));
 if(!records.length)return <AccessEmpty category="custody"/>;
 return <div className={styles.categories}>{records.map(row=><article className={styles.category} key={row.id}>
  <LockKeyhole size={20}/><span><strong>{row.title}</strong>
   <small>{row.custody_code} · {row.item_type} · {row.status} · Custody source is authoritative</small></span>
 </article>)}</div>;
}

export const dynamic="force-dynamic";
type Props={params:Promise<{segments?:string[]}>};
export default async function VaultPages({params}:Props){
 const {segments=[]}=await params;
 const route=segments.join("/");
 const {categories,allowed}=await getOfficeVaultAccess();
 const visible=(slug:string)=>categories.find(row=>row.slug===slug);
 const commonNav=[
  ["Overview","/office/k-vault"],["Company Master","/office/k-vault/company"],
  ["Categories","/office/k-vault/categories"],["Documents","/office/k-vault/documents"],
  ["Access requests","/office/k-vault/requests"],
 ];
 let title="K-Vault";
 let subtitle="A permission-first index of authoritative corporate records. Values and files remain in their source systems.";
 let content:React.ReactNode;
 if (!route) {
   content=<OfficeVaultOverview categories={categories}/>;
 } else if(route==="categories"){
   title="Categories";subtitle="Only resource categories authorized for the current employee.";
   content=<OfficeVaultCategoryBrowser categories={categories}/>;
 } else if(route==="company"){
   title="Company Master";subtitle="Verified company registration references, masked identifiers and independent review evidence.";
   if(!visible("identity")) notFound();
   content=<OfficeVaultCompanyMaster/>;
 } else if(route.startsWith("categories/") && segments.length===2){
   const category=visible(segments[1]);
   if(!category) notFound();
   title=category.title;subtitle=category.description;
   content=<div className={styles.sourceCard}><ShieldCheck size={24}/>
     <div><h2>Source-owned company records</h2>
       <p>All reads and operational changes are authorized by the canonical service. The Vault does not duplicate legal, finance or statutory facts.</p>
       <Link href={category.sourceHref}>{category.sourceLabel} <ArrowRight size={16}/></Link>
     </div>
   </div>;
   if(category.slug==="registrations"||category.slug==="identity")content=<RegisteredRecords category={category.slug}/>;
   if(category.slug==="documents")content=<GrantedDocuments/>;
   if(category.slug==="custody")content=<GrantedCustody/>;
 } else if(route==="documents"){
   title="Documents";subtitle="Canonical documents, version history and source-controlled evidence.";
   if(!visible("documents")) notFound();
   content=<GrantedDocuments/>;
 } else if(route==="requests"){
   title="My access requests";subtitle="Only canonical Office requests can authorize a grant.";
   content=<OfficeVaultAccessCenter/>;
 } else if(route==="access"){
   title="Access administration";subtitle="An administrator's title alone never grants unrestricted document access.";
   if(!allowed.includes("access.profile.assign")) notFound();
   content=<OfficeVaultAccessCenter reviewOnly/>;
 } else if(route==="reviews"){
   title="Verification reviews";subtitle="Independent evidence reviews use the canonical registration authority.";
   if(!allowed.includes("registration.review")) notFound();
   content=<OfficeVaultVerificationQueue/>;
 } else if(route==="activity"){
   title="My Vault activity";subtitle="Only access events attributed to your current AAL2 Office identity.";
   content=<OfficeVaultActivity/>;
 } else if(route==="settings"){
   title="Vault settings";subtitle="Source-system policy controls remain governed and independently reviewed.";
   if(!allowed.includes("access.profile.assign")) notFound();
   content=<OfficeVaultSettings/>;
 } else if(segments.length===2&&segments[0]==="records"){
   if(!(visible("registrations")||visible("identity"))||!/^[0-9a-f-]{36}$/i.test(segments[1])) notFound();
   try {
     await requireOfficeVaultRecord({category:"registrations",recordId:segments[1],action:"READ"});
   } catch(error) {
     if(!(error instanceof OfficeVaultAccessError) || error.status!==404) throw error;
     await requireOfficeVaultRecord({category:"identity",recordId:segments[1],action:"READ"});
   }
   const records=await getOfficeRegistrationOverview();
   const record=records.registrations.find(row=>row.id===segments[1]);
   if(!record) notFound();
   title="Registration record";subtitle="A read-only projection from the source registration registry.";
   const history=records.events.filter(item=>item.registration_id===record.id);
   content=<article className={styles.record}>
     <h2>{record.title}</h2><p>Registration type: {record.registration_type}</p>
     <dl><dt>Authority</dt><dd>{record.authority}</dd><dt>Identifier (masked)</dt><dd>{record.identifier_masked}</dd>
       <dt>Status</dt><dd>{record.status}</dd><dt>Evidence reference</dt><dd>{record.evidence_reference || "Not linked"}</dd>
       <dt>Last update</dt><dd>{record.updated_at}</dd></dl>
     <h3>Source change history</h3>
     {history.length?<ul>{history.map(event=><li key={event.id}>{event.event_type} · {event.created_at}</li>)}</ul>:<p>No history entries are recorded.</p>}
     <Link href="/office/registrations">Open canonical registration record <ArrowRight size={16}/></Link>
   </article>;
 } else if(segments.length===2&&segments[0]==="documents"){
   if(!visible("documents")||!/^[0-9a-f-]{36}$/i.test(segments[1])) notFound();
   await requireOfficeVaultRecord({category:"documents",recordId:segments[1],action:"READ"});
   const records=await getOfficeDocumentStudioOverview();
   const document=records.instances.find(row=>row.id===segments[1]);
   if(!document) notFound();
   title="Document reference";subtitle="Verified metadata and authorized output links from Document Studio.";
   const actions=await getOfficeVaultAllowedActions("documents",segments[1]);
   const renders=records.renders.filter(row=>row.document_instance_id===document.id&&
     ["GENERATED","SIGNED"].includes(row.status));
   // Reuse the canonical Document Studio's already-scoped render, signature,
   // and delivery evidence. A Vault read grant never creates or edits evidence.
   const chronology=[
     ...records.renders.filter(row=>row.document_instance_id===document.id).map(row=>({
       id:"render:"+row.id,kind:"Generated output",state:row.status,
       occurredAt:row.generated_at||null,detail:row.output_format,
     })),
     ...records.signatures.filter(row=>row.document_instance_id===document.id).map(row=>({
       id:"signature:"+row.id,kind:"Signature evidence",state:row.status,
       occurredAt:row.recorded_at||row.signed_at||null,detail:row.signature_method,
     })),
     ...records.deliveries.filter(row=>row.document_instance_id===document.id).map(row=>({
       id:"delivery:"+row.id,kind:"Delivery event",state:row.event_type,
       occurredAt:row.created_at||null,detail:row.channel,
     })),
   ].sort((a,b)=>Date.parse(b.occurredAt??"")-Date.parse(a.occurredAt??""));
   const sourceTemplateVersion=records.versions.find(row=>row.id===document.template_version_id);

   content=<article className={styles.record}>
     <FileLock2 size={30} aria-hidden="true"/><h2>{document.title}</h2>
     <dl><dt>Document code</dt><dd>{document.document_code}</dd><dt>Classification</dt><dd>{document.classification}</dd>
     <dt>Status</dt><dd>{document.status}</dd><dt>Recorded</dt><dd>{document.created_at}</dd></dl>
     <h3>Source and version evidence</h3>
     <dl><dt>Document source</dt><dd>Canonical Document Studio</dd>
       <dt>Template version</dt><dd>{sourceTemplateVersion?.version??"Not visible to this identity"}</dd>
       <dt>Approval status</dt><dd>{document.status}</dd></dl>
     <h3>Evidence chronology</h3>
     {chronology.length?<ol className={styles.chronology}>{chronology.map(event=>
       <li key={event.id}><div><strong>{event.kind}</strong><small>{event.detail} · {event.state}</small></div>
        <time dateTime={event.occurredAt??undefined}>{event.occurredAt
         ?new Date(event.occurredAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})
         :"Time not recorded"}</time>
       </li>)}</ol>:<p>No accessible generation, signature or delivery events have been recorded.</p>}
     <h3>Available authorized outputs</h3>
     {renders.length?<ul>{renders.map(render=><li key={render.id}>
       <strong>{render.output_format}</strong> · {render.status} · {render.byte_size.toLocaleString("en-IN")} bytes
       {actions.download?<a href={"/api/office-vault/documents/"+render.id+"/download"}>Authorized download</a>:null}
       {actions.preview&&render.output_format==="PDF"?<details>
         <summary>Preview protected PDF</summary>
         <iframe className={styles.documentPreview} title={"Secure preview: "+document.title}
           src={"/api/office-vault/documents/"+render.id+"/preview"}
           referrerPolicy="no-referrer" sandbox="allow-same-origin" loading="lazy"/>
       </details>:null}
     </li>)}</ul>:<p>No current generated or signed output is available.</p>}
     {renders.length&&!actions.download?<Link href="/office/k-vault/requests">Request download authorization <ArrowRight size={16}/></Link>:null}
     <p>Files are retrieved through the canonical document service, which rechecks download permissions and integrity.</p>
     <Link href="/office/documents">Open Document Studio <ArrowRight size={16}/></Link>
   </article>;
 } else notFound();
 return <section className={styles.vault} aria-label="KRAVIA K-Vault">
  <header className={styles.header}><div><p className={styles.eyebrow}>KRAVIA OFFICE · SECURE RECORDS</p><h1>{title}</h1><p>{subtitle}</p></div>
   <Link href="/office/requests"><ShieldCheck size={16}/>Request access</Link>
  </header>
  <nav className={styles.nav} aria-label="Vault navigation">{commonNav.map(([name,href])=>
   <Link key={href} href={href} aria-current={"/office/k-vault"+(route?"/"+route:"")===href?"page":undefined}>{name}</Link>)}</nav>
  {content}
  <p className={styles.footnote}><ShieldCheck size={15}/>Vault content is permission-scoped. Source approvals, document provenance and access audits remain authoritative.</p>
 </section>;
}
