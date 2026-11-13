"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, BadgeCheck, BookOpen, Check, CheckCircle2,
  ChevronRight, CircleHelp, Download, FileText, LockKeyhole, Search, ShieldCheck,
  UserRound, X,
} from "lucide-react";
import styles from "./office-manual-hub.module.css";

type ManualState = "PENDING"|"IN_PROGRESS"|"REVIEW_REQUIRED"|"ACKNOWLEDGED";
type AssignedManual = {key:string;id:string;title:string;version:string;status:ManualState;opened_at:string|null;acknowledged_at:string|null};
type Guide = {id:string;name:string;purpose:string;firstDay:string[];daily:string[];completion:string;boundaries:string;routes:string[]};
type Route = {href:string;title:string;group:string;description:string;workspace:"office"|"finance"};
type Chapter = {id:string;title:string;steps:string[]};
type ResponsePayload = {
  edition:string;actor:{display_name:string;roles:string[];department:string|null};
  manuals:AssignedManual[];roles:Guide[];common:Chapter[];routes:Route[];outstanding:number;disclaimer:string;
  full_documents:Record<string,string>;
  full_atlas:string|null;
};
type Tab = "overview"|"reading"|"routes"|"help";
const labels:Record<ManualState,string>={
  PENDING:"Pending",IN_PROGRESS:"In progress",REVIEW_REQUIRED:"Review new version",ACKNOWLEDGED:"Acknowledged",
};

async function decode<T>(response:Response):Promise<T> {
  const body=await response.json().catch(()=>({detail:"The manual service did not respond."}));
  if(!response.ok)throw new Error(String(body.detail||"Manual action failed"));
  return body as T;
}
function statusLabel(state:ManualState){return labels[state];}
function displayLine(value:string){
  return value.replace(/\*\*/g,"").replaceAll(String.fromCharCode(96),"")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,"$1 ($2)");
}
function DetailedManual({markdown}:{markdown:string}){
  return <div className={styles.detailedDocument} aria-label="Full handbook text">
    {markdown.split("\n").map((raw,index)=>{
      const line=raw.trim();
      if(!line)return <div key={index} className={styles.manualWhitespace}/>;
      if(/^---+$/.test(line))return <hr key={index}/>;
      if(line.startsWith("### "))return <h4 key={index}>{displayLine(line.slice(4))}</h4>;
      if(line.startsWith("## "))return <h3 key={index}>{displayLine(line.slice(3))}</h3>;
      if(line.startsWith("# "))return <h3 key={index}>{displayLine(line.slice(2))}</h3>;
      if(line.startsWith(">"))return <blockquote key={index}>{displayLine(line.replace(/^>\s?/,""))}</blockquote>;
      if(line.startsWith("|")){
        if(/^\|[\s|:\-]+\|?$/.test(line))return null;
        const cells=line.split("|").slice(1,-1).map(cell=>displayLine(cell.trim()));
        return <p className={styles.manualTableLine} key={index}>{cells.join("  ·  ")}</p>;
      }
      if(/^\d+\.\s/.test(line))return <p className={styles.manualListLine} key={index}>{displayLine(line)}</p>;
      if(/^[-*]\s/.test(line))return <p className={styles.manualBullet} key={index}>• {displayLine(line.slice(2))}</p>;
      return <p className={styles.manualParagraph} key={index}>{displayLine(line)}</p>;
    })}
  </div>;
}

export function OfficeManualHub(){
  const [data,setData]=useState<ResponsePayload|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [tab,setTab]=useState<Tab>("overview");
  const [opened,setOpened]=useState<string|null>(null);
  const [readerMode,setReaderMode]=useState<"complete"|"summary">("complete");
  const [filter,setFilter]=useState("");
  const [agree,setAgree]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    try{
      const payload=await decode<ResponsePayload>(await fetch("/api/office-manual",{cache:"no-store",credentials:"same-origin"}));
      setData(payload);setError("");
      window.dispatchEvent(new CustomEvent("kravia-office-manual-state",{detail:payload.outstanding}));
    }catch(e){setError(e instanceof Error?e.message:"Manual is unavailable");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function mutate(action:"OPEN"|"ACKNOWLEDGE",key:string){
    setBusy(true);setError("");setNotice("");
    try{
      await decode(await fetch("/api/office-manual",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,key})}));
      await load();
      if(action==="ACKNOWLEDGE")setNotice("This published manual version was acknowledged. It does not grant access or replace a signed document.");
    }catch(e){setError(e instanceof Error?e.message:"Unable to record reading");}
    finally{setBusy(false);}
  }
  function openManual(manual:AssignedManual){
    setOpened(manual.key);setTab("reading");setReaderMode("complete");setAgree(false);setNotice("");
    if(manual.status!=="ACKNOWLEDGED")void mutate("OPEN",manual.key);
  }

  const current=data?.manuals.find(m=>m.key===opened)??null;
  const guide=current&&current.id!=="common"?data?.roles.find(role=>role.id===current.id):undefined;
  const filteredRoutes=useMemo(()=>{
    const query=filter.trim().toLowerCase();
    return (data?.routes??[]).filter(route=>!query||
      (route.title+" "+route.group+" "+route.description+" "+route.href).toLowerCase().includes(query));
  },[data,filter]);
  if(loading)return <section className={styles.state}><BookOpen/><p>Loading your permission-scoped Office guides…</p></section>;
  if(!data)return <section className={styles.state}><AlertCircle/><h2>Info &amp; Help is unavailable</h2><p>{error}</p><button onClick={()=>void load()} type="button">Try again</button></section>;
  const selectedRoutes=guide?.routes.map(path=>{
    const url=path.startsWith("finance:")?"/finance/"+path.slice(8):"/office/"+path;
    const available=data.routes.find(route=>route.href===url);
    return {name:path,url,available};
  })??[];
  const allRead=data.outstanding===0;
  return <section className={styles.shell} aria-label="KRAVIA Office Info and Help">
    <header className={styles.hero}>
      <div className={styles.heroIcon}><BookOpen size={25}/></div>
      <div className={styles.heroCopy}><p>KRAVIA OFFICE · LEARNING CENTER</p><h2>Your Office guide</h2>
        <span>Common instructions, your assigned roles, permitted routes and verified reading history.</span></div>
      <div className={styles.heroAction}><span className={styles.version}>Edition {data.edition}</span>
        <a href="/api/office-manual/download" className={styles.download}>
          <Download size={16}/> Download my PDF
        </a>
      </div>
    </header>
    <div className={styles.stats}>
      <div><span>Assigned manuals</span><strong>{data.manuals.length}</strong></div>
      <div><span>Needs acknowledgement</span><strong>{data.outstanding}</strong></div>
      <div><span>Available sections</span><strong>{data.routes.length}</strong></div>
      <div><span>Reading status</span><strong className={styles.smallResult}>{allRead?"Up to date":"Action required"}</strong></div>
    </div>
    {notice?<p className={styles.notice} role="status"><CheckCircle2 size={17}/>{notice}
      <button type="button" onClick={()=>setNotice("")} aria-label="Dismiss"><X size={15}/></button></p>:null}
    {error?<p className={styles.error} role="alert"><AlertCircle size={16}/>{error}</p>:null}
    <nav className={styles.tabs} aria-label="Manual sections">
      <button type="button" data-active={tab==="overview"} onClick={()=>setTab("overview")}><BookOpen size={16}/> Overview</button>
      <button type="button" data-active={tab==="reading"} onClick={()=>{setTab("reading");if(!opened)setOpened(data.manuals[0]?.key??null);}}><FileText size={16}/> Read manual</button>
      <button type="button" data-active={tab==="routes"} onClick={()=>setTab("routes")}><Search size={16}/> Find a screen</button>
      <button type="button" data-active={tab==="help"} onClick={()=>setTab("help")}><CircleHelp size={16}/> Troubleshooting</button>
    </nav>
    {tab==="overview"?<div className={styles.body}>
      <div className={styles.sectionHeading}><h3>Start here</h3><p>Your documents are assigned from the current verified company role record. A job title never expands your permissions.</p></div>
      <div className={styles.cards}>{data.manuals.map(manual=><article className={styles.manualCard} key={manual.key}>
        <div className={styles.cardTop}><div className={styles.cardIcon}><FileText size={19}/></div>
          <span className={styles.badge} data-status={manual.status}>{statusLabel(manual.status)}</span></div>
        <h4>{manual.title}</h4><p>Published version {manual.version}</p>
        <button type="button" onClick={()=>openManual(manual)}> {manual.status==="ACKNOWLEDGED"?"Read again":"Open and read"} <ArrowRight size={16}/></button>
        {manual.acknowledged_at?<small>Last acknowledged {new Date(manual.acknowledged_at).toLocaleDateString("en-IN")}</small>:null}
      </article>)}</div>
      <div className={styles.noticePlain}><ShieldCheck size={19}/><p>{data.disclaimer}</p></div>
      <div className={styles.quickLinks}><h3>Frequent starting points</h3><div>
        {data.routes.filter(route=>["dashboard","my-role","tasks","requests","worktime","settings"].some(slug=>route.href.endsWith("/"+slug))).slice(0,8)
          .map(route=><Link href={route.href} key={route.href}>{route.title}<ChevronRight size={16}/></Link>)}
      </div></div>
    </div>:null}
    {tab==="reading"?<div className={styles.body}>
      <div className={styles.readerLayout}>
        <aside className={styles.readerAside} aria-label="My manual documents">
          <h3>My manuals</h3>
          {data.manuals.map(manual=><button type="button" key={manual.key} data-active={opened===manual.key}
            onClick={()=>openManual(manual)}><FileText size={16}/><span>{manual.title}<small>{statusLabel(manual.status)}</small></span></button>)}
        </aside>
        <article className={styles.reader}>
          {!current?<p>Choose a manual from the list to begin reading.</p>:<>
            <div className={styles.readerHeader}><div><p>EDITION {current.version}</p><h3>{current.title}</h3></div>
              <span className={styles.badge} data-status={current.status}>{statusLabel(current.status)}</span></div>
            <div className={styles.readerMode} role="group" aria-label="Select reading depth">
              <button type="button" data-active={readerMode==="complete"} onClick={()=>setReaderMode("complete")}>Complete manual</button>
              <button type="button" data-active={readerMode==="summary"} onClick={()=>setReaderMode("summary")}>Quick summary</button>
            </div>
            {readerMode==="complete" && data.full_documents[current.key]
              ? <DetailedManual markdown={data.full_documents[current.key]}/>
              : <>
            {current.id==="common"?data.common.map(chapter=><section key={chapter.id} className={styles.chapter}>
              <h4>{chapter.title}</h4><ol>{chapter.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
            </section>):guide?<div className={styles.roleBody}>
              <p className={styles.rolePurpose}>{guide.purpose}</p>
              <h4>First access and induction</h4><ol>{guide.firstDay.map((step,i)=><li key={i}>{step}</li>)}</ol>
              <h4>Daily and recurring work</h4><ol>{guide.daily.map((step,i)=><li key={i}>{step}</li>)}</ol>
              <h4>How to know work is complete</h4><p>{guide.completion}</p>
              <h4>Access and authority boundary</h4><p>{guide.boundaries}</p>
              <h4>Where to work</h4><div className={styles.routeLinks}>{selectedRoutes.map(({name,url,available})=>
                available?<Link href={url} key={name}><Check size={14}/>{available.title}<ArrowRight size={14}/></Link>:
                <span key={name} className={styles.restricted}><LockKeyhole size={14}/>{name.replace("finance:","Finance / ").replaceAll("-"," ")} · Not assigned</span>)}</div>
            </div>:<p>Role manual is unavailable for this identity.</p>}
                </>}
            <div className={styles.ack}>
              <h4>Confirm this version</h4>
              <p>Reading this handbook does not verify onboarding documents, approve a policy, or constitute a legally signed acknowledgement.</p>
              {current.status==="ACKNOWLEDGED"?<p className={styles.done}><BadgeCheck size={17}/> Acknowledged on {current.acknowledged_at?new Date(current.acknowledged_at).toLocaleString("en-IN"):"your recorded date"}</p>:<>
                <label><input type="checkbox" checked={agree} onChange={event=>setAgree(event.target.checked)}/> I have read this entire document and understand that my actual permissions remain separately controlled.</label>
                <button type="button" className={styles.primary} disabled={!agree||busy||current.status==="PENDING"} onClick={()=>void mutate("ACKNOWLEDGE",current.key)}>
                  <BadgeCheck size={16}/>{busy?"Recording…":"Acknowledge this version"}
                </button>
                {current.status==="PENDING"?<small>Opening the document must be recorded before acknowledgement.</small>:null}
              </>}
            </div>
          </>}
        </article>
      </div>
    </div>:null}
    {tab==="routes"?<div className={styles.body}>
      <div className={styles.sectionHeading}><h3>Find a screen</h3><p>Only sections allowed by your current role and capability assignments are listed. Routes can change after access review.</p></div>
      <label className={styles.search}><Search size={18}/><input value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Search by task, screen name or route" aria-label="Search my Office routes"/></label>
      {data.full_atlas?<details className={styles.atlasDisclosure}><summary>Owner reference: complete 75-route atlas and directions</summary>
        <p>The original source-audited navigation reference includes other departments. It does not bypass any access policy or attest production deployment.</p>
        <DetailedManual markdown={data.full_atlas}/>
      </details>:null}
      <div className={styles.routeList}>{filteredRoutes.map(route=><Link key={route.href} className={styles.routeRow} href={route.href}>
        <span><b>{route.title}</b><small>{route.description}</small><code>{route.href}</code></span><ChevronRight size={18}/></Link>)}
        {!filteredRoutes.length?<p>No permitted screen matches that search. Request access only through an authorized workflow.</p>:null}
      </div>
    </div>:null}
    {tab==="help"?<div className={styles.body}>
      <div className={styles.sectionHeading}><h3>When something goes wrong</h3><p>Use verified help paths. Never paste OTPs, passwords, complete bank numbers or identity documents into a support case.</p></div>
      <div className={styles.faq}>
        <details><summary>I did not receive or cannot open an invitation</summary><p>Check the private invitation and expiry. Contact the authorized inviter for a replacement; public registration is closed. <Link href="/office/quick-start">First-access instructions</Link></p></details>
        <details><summary>My Authenticator or trusted device is unavailable</summary><p>Use <Link href="/office/authenticator">Authenticator guidance</Link>. Request governed recovery from an Office administrator. Do not reuse another person&apos;s phone or code.</p></details>
        <details><summary>A module is missing from my sidebar</summary><p>Menus are filtered by active roles and scoped access. Open your permitted Requests page or contact your manager to propose access with a specific business reason.</p></details>
        <details><summary>My attendance or salary figure appears incorrect</summary><p>Check recorded net worktime and submitted evidence. Raise an HR review, not a manual payment or historical entry without records.</p></details>
        <details><summary>A customer case or technical issue needs escalation</summary><p>Use the permitted Support operations or IT service desk modules, or start a governed request. An approval is not a substitute for the underlying required action.</p></details>
        <details><summary>I cannot sign in</summary><p>Use <Link href="/office/recover">controlled recovery</Link> and the original verified KRAVIA domain only.</p></details>
      </div>
    </div>:null}
    <footer className={styles.footer}>KRAVIA PRIVATE LIMITED · Private internal training · Versioned acknowledgement is not an e-signature</footer>
  </section>;
}
