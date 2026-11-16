"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowLeft,ArrowRight,FileText,FileVideo,FileImage,ShieldCheck,Send,Trash2,X,RefreshCw} from "lucide-react";
import type {Office5FileStatus} from "@/components/office5-primitives";
import styles from "./office-connect-attachment-preview.module.css";

export type ConnectDraftFile={
 key:string;name:string;size?:number;mime?:string;previewUrl?:string;
 id?:string;status:Office5FileStatus;message?:string;
};
type Props={
 open:boolean;files:ConnectDraftFile[];caption:string;busy:boolean;
 onCaption:(value:string)=>void;
 onRemove:(key:string)=>void;
 onMove:(key:string,direction:-1|1)=>void;
 onRetry:(id:string)=>void;
 onClose:()=>void;onSend:()=>void;
};
const fileSize=(bytes?:number)=>bytes==null?"":bytes<1048576?
  Math.max(1,Math.round(bytes/1024))+" KiB":(bytes/1048576).toFixed(2)+" MiB";
export function OfficeConnectAttachmentPreview({
 open,files,caption,busy,onCaption,onRemove,onMove,onRetry,onClose,onSend,
}:Props){
 const [mounted,setMounted]=useState(false);
 const [selected,setSelected]=useState(0);
 const panel=useRef<HTMLElement|null>(null);
 const closeRef=useRef(onClose);
 useEffect(()=>{closeRef.current=onClose;},[onClose]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setMounted(true));return()=>cancelAnimationFrame(frame);},[]);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const frame=requestAnimationFrame(()=>panel.current?.focus());
  const trap=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();closeRef.current();return;}
   if(event.key!=="Tab"||!panel.current)return;
   const tabbables=Array.from(panel.current.querySelectorAll<HTMLElement>(
    'button:not(:disabled),textarea:not(:disabled),a[href]'
   )).filter(el=>el.offsetParent!==null);
   if(!tabbables.length)return;
   const first=tabbables[0],last=tabbables[tabbables.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",trap);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener("keydown",trap);previous?.focus();};
 },[open]);
 if(!mounted||!open||!files.length)return null;
 const index=Math.min(selected,files.length-1);
 const file=files[index];
 const canSend=!busy&&files.every(f=>f.status==="available"&&!!f.id);
 return createPortal(<div className={styles.backdrop}
  onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={panel} className={styles.dialog} role="dialog" aria-modal="true"
   aria-labelledby="connect-attachment-title" tabIndex={-1}>
   <header className={styles.header}>
    <div><h2 id="connect-attachment-title">Review attachments</h2>
     <p><ShieldCheck size={13}/>Private draft · Nothing has been sent</p></div>
    <button type="button" className={styles.iconButton} aria-label="Close attachment preview"
     onClick={onClose}><X size={19}/></button>
   </header>
   <div className={styles.preview} aria-live="polite">
    {file.previewUrl&&file.mime?.startsWith("image/")?
     <img key={file.key} src={file.previewUrl} alt={"Preview: "+file.name}/>:
     file.previewUrl&&file.mime?.startsWith("video/")?
      <video key={file.key} controls playsInline preload="metadata" aria-label={"Video preview: "+file.name}>
       <source src={file.previewUrl} type={file.mime}/></video>:
      file.previewUrl&&file.mime==="application/pdf"?
       <iframe key={file.key} title={"PDF preview: "+file.name} src={file.previewUrl}
        sandbox="" referrerPolicy="no-referrer"/>:
       <div className={styles.fallback}>
        {file.mime?.startsWith("video/")?<FileVideo size={44}/>:
         file.mime?.startsWith("image/")?<FileImage size={44}/>:<FileText size={44}/>}
        <strong>{file.name}</strong>
        <span>Safe local preview unavailable for this file format</span>
       </div>}
   </div>
   <div className={styles.fileHeading}>
    <div><strong>{file.name}</strong><small>{fileSize(file.size)} · {file.status}
      {file.message?" · "+file.message:""}</small></div>
    <button className={styles.remove} type="button" aria-label={"Remove "+file.name}
     onClick={()=>{onRemove(file.key);setSelected(n=>Math.max(0,n-1));}}><Trash2 size={16}/></button>
   </div>
   <div className={styles.filmstrip} role="group" aria-label="Attachment thumbnails">
    {files.map((item,i)=><button key={item.key} type="button"
      className={styles.thumbnail} data-current={i===index}
      aria-label={"Preview "+item.name} aria-pressed={i===index}
      onClick={()=>setSelected(i)}>
       {item.previewUrl&&item.mime?.startsWith("image/")?
        <img src={item.previewUrl} alt=""/>:<FileText size={20}/>}
       <span>{item.name}</span>
      </button>)}
   </div>
   <div className={styles.controls}>
    <button type="button" disabled={index===0}
     onClick={()=>{onMove(file.key,-1);setSelected(index-1);}}><ArrowLeft size={15}/>Move left</button>
    <button type="button" disabled={index===files.length-1}
     onClick={()=>{onMove(file.key,1);setSelected(index+1);}}>Move right<ArrowRight size={15}/></button>
    {file.id&&file.status!=="available"&&file.status!=="blocked"?
     <button type="button" onClick={()=>onRetry(file.id!)} disabled={busy}>
      <RefreshCw size={15}/>Retry scan</button>:null}
   </div>
   <label className={styles.caption}>Message or caption (optional)
    <textarea value={caption} maxLength={4000} rows={2} placeholder="Add a message…"
     onChange={e=>onCaption(e.target.value)}/>
   </label>
   <footer className={styles.footer}>
    <p><ShieldCheck size={15}/>Only scanner-confirmed attachments can be sent.</p>
    <button type="button" className={styles.send} disabled={!canSend} onClick={onSend}>
     <Send size={17}/>{busy?"Preparing securely…":canSend?"Send "+files.length+" file"+(files.length===1?"":"s"):"Awaiting scan"}
    </button>
   </footer>
  </section>
 </div>,document.querySelector("[data-ui-theme]")??document.body);
}
