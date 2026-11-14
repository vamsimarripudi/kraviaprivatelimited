"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,FileLock2,RefreshCw,ShieldCheck} from "lucide-react";
import styles from "./office-connect-files.module.css";
type Row={id:string;conversation_id:string;message_id:string;original_filename:string;detected_mime_type:string;byte_size:number;created_at:string};
export function OfficeConnectSharedFiles(){
 const [rows,setRows]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true;
  void (async()=>{try{
   const response=await fetch("/api/office-chat/attachments",{credentials:"same-origin",cache:"no-store"});
   const body=await response.json().catch(()=>({})) as {files?:Row[];detail?:string};
   if(!response.ok)throw new Error(body.detail??"Private files unavailable");
   if(live){setRows(body.files??[]);setError("");}
  }catch(e){if(live)setError(e instanceof Error?e.message:"Private attachments unavailable");}
  finally{if(live)setLoading(false);}
  })();return()=>{live=false};
 },[retry]);
 return <section className={styles.shell}>
  <header><div><Link href="/office/chat"><ArrowLeft size={16}/>Connect</Link>
   <p>KRAVIA CONNECT · SECURITY CONTROLLED</p><h1>Shared files</h1>
   <span>Only clean, committed attachments in conversations you can still access appear here. No public storage URLs.</span>
  </div><button type="button" onClick={()=>{setLoading(true);setRetry(v=>v+1);}}><RefreshCw size={16}/>Refresh</button></header>
  {loading?<p role="status">Checking scan status and conversation membership…</p>:null}
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {!loading&&!error&&!rows.length?<div className={styles.empty}><FileLock2 size={24}/>
   <h2>No accessible shared attachments</h2><p>Open a verified conversation to upload and share a file after the corporate scanner approves it.</p>
   <Link href="/office/chat">Open conversations</Link></div>:null}
  <div className={styles.list}>{rows.map(row=><article key={row.id}>
    <FileLock2 size={21}/><div><strong>{row.original_filename}</strong>
     <small>{row.detected_mime_type} · {Math.ceil(row.byte_size/1024)} KiB · scanned & linked</small></div>
    <a href={"/api/office-chat/attachments/"+row.id+"/download"}>Authorized download</a>
   </article>)}</div>
  <p className={styles.note}><ShieldCheck size={16}/>A fresh membership and SHA-256 integrity verification precede every download; downloads are audited.</p>
 </section>;
}
