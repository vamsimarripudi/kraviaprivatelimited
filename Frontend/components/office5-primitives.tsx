"use client";
import {useEffect,useRef,type ReactNode} from "react";
import Link from "next/link";
import {AlertTriangle,BadgeCheck,CheckCircle2,FileLock2,Info,LoaderCircle,LockKeyhole,RotateCcw,ShieldAlert,Trash2,UploadCloud,X} from "lucide-react";
import styles from "./office5-primitives.module.css";

export type Office5StateKind="loading"|"empty"|"error"|"denied"|"expired"|"not-found"|"offline"|"quarantine";
type StateProps={kind:Office5StateKind;title?:string;description?:string;actionLabel?:string;onAction?:()=>void;href?:string};
const catalog:Record<Office5StateKind,{title:string;description:string}>={
 loading:{title:"Loading authorized data",description:"Resolving your current record and action permissions."},
 empty:{title:"No authorized records",description:"There are no records available to this session."},
 error:{title:"Request failed",description:"The source service did not confirm the result. Your previous draft has not been discarded."},
 denied:{title:"Access restricted",description:"The current identity is not authorized to view this resource."},
 expired:{title:"Session expired",description:"Sign in again and complete required MFA before opening protected content."},
 "not-found":{title:"Record unavailable",description:"This resource is missing or outside your current access scope."},
 offline:{title:"Connection interrupted",description:"Changes are not confirmed. Restore the connection and retry without duplicating the operation."},
 quarantine:{title:"Evidence held for security review",description:"The upload is not available for preview or download until its scan has been verified."},
};
export function Office5State({kind,title,description,actionLabel,onAction,href}:StateProps){
 const Icon=kind==="loading"?LoaderCircle:kind==="denied"||kind==="not-found"?LockKeyhole:
  kind==="empty"?Info:kind==="quarantine"?FileLock2:kind==="error"||kind==="offline"?AlertTriangle:ShieldAlert;
 return <section className={styles.state} data-kind={kind} role={kind==="error"||kind==="expired"?"alert":"status"}
   aria-busy={kind==="loading"}>
  <Icon aria-hidden="true" className={kind==="loading"?styles.spin:undefined} size={28}/>
  <h2>{title??catalog[kind].title}</h2><p>{description??catalog[kind].description}</p>
  {onAction?<button type="button" onClick={onAction}><RotateCcw size={16}/>{actionLabel??"Retry"}</button>:null}
  {href?<Link href={href}>{actionLabel??"Open safe workspace"}</Link>:null}
 </section>;
}
type DialogProps={open:boolean;title:string;description?:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean};
export function Office5Dialog({open,title,description,children,onClose,busy=false,wide=false}:DialogProps){
 const ref=useRef<HTMLDialogElement>(null);
 const priorFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const node=ref.current;if(!node)return;
  if(open){
   priorFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
   if(!node.open)node.showModal();
  }else if(node.open){node.close();}
  return()=>{if(node.open)node.close();if(priorFocus.current)priorFocus.current.focus();};
 },[open]);
 return <dialog ref={ref} className={styles.dialog} data-wide={wide} aria-label={title}
   onCancel={e=>{if(busy)e.preventDefault();else onClose();}}
   onClose={()=>{if(open&&!busy)onClose();priorFocus.current?.focus();}}
   onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <header><div><h2>{title}</h2>{description?<p>{description}</p>:null}</div>
   <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18}/></button></header>
  <div className={styles.dialogBody}>{children}</div>
 </dialog>;
}
type ConfirmProps={open:boolean;title:string;description:string;danger?:boolean;busy?:boolean;confirmLabel?:string;onConfirm:()=>void;onCancel:()=>void};
export function Office5Confirm({open,title,description,danger=false,busy=false,confirmLabel="Confirm",onConfirm,onCancel}:ConfirmProps){
 return <Office5Dialog open={open} title={title} description={description} onClose={onCancel} busy={busy}>
  <footer className={styles.actions}>
   <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
   <button type="button" data-danger={danger} disabled={busy} onClick={onConfirm}>
     {danger?<Trash2 size={16}/>:<BadgeCheck size={16}/>}
     {busy?"Confirming…":confirmLabel}</button>
  </footer>
 </Office5Dialog>;
}
type NoticeTone="info"|"success"|"warning"|"error";
type NoticeProps={tone:NoticeTone;children:ReactNode;onDismiss?:()=>void};
export function Office5Notice({tone,children,onDismiss}:NoticeProps){
 const Icon=tone==="success"?CheckCircle2:tone==="info"?Info:ShieldAlert;
 return <div className={styles.notice} data-tone={tone} role={tone==="error"?"alert":"status"}>
  <Icon aria-hidden="true" size={17}/><span>{children}</span>
  {onDismiss?<button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={16}/></button>:null}
 </div>;
}
export type Office5FileStatus="selected"|"uploading"|"scanning"|"available"|"blocked"|"unknown"|"expired"|"failed";
type FileCardProps={name:string;status:Office5FileStatus;progress?:number;reason?:string;
 onRetry?:()=>void;onCancel?:()=>void;onDownload?:()=>void};
export function Office5FileCard({name,status,progress,reason,onRetry,onCancel,onDownload}:FileCardProps){
 const safeProgress=typeof progress==="number"?Math.min(100,Math.max(0,progress)):0;
 const caption:Record<Office5FileStatus,string>={
 selected:"Selected — awaiting upload",uploading:"Uploading securely",scanning:"Quarantined — verification pending",
 available:"Scanned and available",blocked:"Blocked by security controls",unknown:"Scan status unknown",
 expired:"Access expired",failed:"Upload failed; no availability confirmed"
 };
 return <article className={styles.file} aria-live="polite" data-status={status}>
  <UploadCloud size={24} aria-hidden="true"/>
  <div><strong>{name}</strong><span>{caption[status]}</span>
   {reason?<small>{reason}</small>:null}
   {status==="uploading"?<progress value={safeProgress} max={100} aria-label="Upload progress"/>:null}
  </div>
  {(status==="failed"||status==="unknown")&&onRetry?<button type="button" onClick={onRetry}>Retry</button>:null}
  {(status==="selected"||status==="uploading")&&onCancel?<button type="button" onClick={onCancel}>Cancel</button>:null}
  {status==="available"&&onDownload?<button type="button" onClick={onDownload}>Open authorized file</button>:null}
 </article>;
}
