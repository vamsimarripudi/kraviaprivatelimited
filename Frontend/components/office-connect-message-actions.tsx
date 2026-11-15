"use client";
import {useState,useEffect,useLayoutEffect,useRef,type FormEvent} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import {Bookmark,Copy,CornerDownRight,Edit3,Flag,History,Pin,PinOff,Trash2,SmilePlus,MoreHorizontal} from "lucide-react";
import styles from "./office-connect-message-actions.module.css";
type Reaction={emoji:string;count:number;mine:boolean};
type Props={id:string;body:string;own:boolean;pinned?:boolean;canPin?:boolean;
 reactions?:Reaction[];editedAt?:string|null;sentAt?:string;onDone:()=>void;menuOpen?:boolean;onToggleMenu?:()=>void};
type RevisionResponse={created_at:string;edited_at:string|null;current_body:string;
 previous_versions:{id:number;body:string;revised_at:string}[]};
async function mutation<T>(url:string,method:string,payload?:Record<string,unknown>):Promise<T>{
 const response=await fetch(url,{method,credentials:"same-origin",
  headers:{"Content-Type":"application/json"},body:payload?JSON.stringify(payload):undefined});
 const data=await response.json().catch(()=>({})) as T&{detail?:string};
 if(!response.ok)throw new Error(data.detail||"Action not confirmed");
 return data;
}
export function OfficeConnectMessageActions({id,body,own,pinned=false,canPin=false,reactions=[],editedAt,sentAt,onDone,menuOpen,onToggleMenu}:Props){
 const [localMenuOpen,setLocalMenuOpen]=useState(false);
 const isOpen=menuOpen??localMenuOpen;
 const toggleMenu=onToggleMenu??(()=>setLocalMenuOpen(value=>!value));
 const [infoOpen,setInfoOpen]=useState(false);
 const [editing,setEditing]=useState(false);
 const [remove,setRemove]=useState(false);
 const [draft,setDraft]=useState(body);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [historyOpen,setHistoryOpen]=useState(false);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [history,setHistory]=useState<RevisionResponse|null>(null);
 const [reportOpen,setReportOpen]=useState(false);
 const [reactionsExpanded,setReactionsExpanded]=useState(false);
 const [reportCategory,setReportCategory]=useState("CODE_OF_CONDUCT");
 const [reportSeverity,setReportSeverity]=useState("MEDIUM");
 const [reportDetail,setReportDetail]=useState("");
 const anchorRef=useRef<HTMLButtonElement>(null);
 const floatingRef=useRef<HTMLElement>(null);
 const expanded=isOpen||infoOpen||editing||remove||historyOpen||reportOpen||reactionsExpanded||Boolean(notice);
 // Portalling detaches action sheets from the clipped message timeline.
 // Measure the actual trigger; account for narrow/mobile visual viewports.
 useLayoutEffect(()=>{
  if(!expanded)return;
  const place=()=>{
   const trigger=anchorRef.current,panel=floatingRef.current;
   if(!trigger||!panel)return;
   const anchor=trigger.getBoundingClientRect();
   const viewport=window.visualViewport;
   const vw=viewport?.width??window.innerWidth;
   const vh=viewport?.height??window.innerHeight;
   const insetLeft=viewport?.offsetLeft??0;
   const insetTop=viewport?.offsetTop??0;
   const width=panel.offsetWidth,height=panel.offsetHeight;
   const mobile=vw<=767;
   const horizontal=mobile?(vw-width)/2:(own?anchor.right-width:anchor.left);
   const left=Math.max(insetLeft+12,Math.min(horizontal+insetLeft,vw-width+insetLeft-12));
   let top=mobile?vh-height-78:anchor.bottom+7;
   if(!mobile&&top+height>vh-12)top=anchor.top-height-7;
   top=Math.max(insetTop+12,Math.min(top+insetTop,vh-height+insetTop-12));
   panel.style.left=Math.round(left)+"px";
   panel.style.top=Math.round(top)+"px";
  };
  place();
  const frame=window.requestAnimationFrame(place);
  window.addEventListener("resize",place);
  window.addEventListener("scroll",place,true);
  window.visualViewport?.addEventListener("resize",place);
  return()=>{
   window.cancelAnimationFrame(frame);
   window.removeEventListener("resize",place);
   window.removeEventListener("scroll",place,true);
   window.visualViewport?.removeEventListener("resize",place);
  };
 },[expanded,own,isOpen,infoOpen,editing,remove,historyOpen,reportOpen,reactionsExpanded,notice]);
 useEffect(()=>{
  if(!expanded)return;
  const dismiss=()=>{
   if(isOpen){if(onToggleMenu)onToggleMenu();else setLocalMenuOpen(false);}
   setInfoOpen(false);setEditing(false);setRemove(false);
   setHistoryOpen(false);setReportOpen(false);setReactionsExpanded(false);
   setNotice("");
  };
  const outside=(event:PointerEvent)=>{
   const node=event.target as Node;
   if(anchorRef.current?.contains(node)||floatingRef.current?.contains(node))return;
   dismiss();
  };
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();dismiss();anchorRef.current?.focus();}
  };
  document.addEventListener("pointerdown",outside);
  document.addEventListener("keydown",keyboard);
  return()=>{document.removeEventListener("pointerdown",outside);
   document.removeEventListener("keydown",keyboard);};
 },[expanded,isOpen,onToggleMenu]);
 async function copyText(){
  try{await navigator.clipboard.writeText(body);setNotice("Message copied");}
  catch{setNotice("Clipboard unavailable. Use your browser's copy command.");}
 }

 async function save(){
  setBusy(true);setNotice("");
  try{await mutation("/api/office-chat/saved","POST",{message_id:id,save:true});
   setNotice("Saved in your private references");}
  catch(e){setNotice(e instanceof Error?e.message:"Save not confirmed")}
  finally{setBusy(false)}
 }
 async function edit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setNotice("");
  try{await mutation("/api/office-chat/messages/"+id,"PATCH",{body:draft.trim()});
   setEditing(false);onDone();}
  catch(e){setNotice(e instanceof Error?e.message:"Edit not confirmed")}
  finally{setBusy(false)}
 }
 async function react(emoji:string,mine:boolean){
  setBusy(true);setNotice("");
  try{
   await mutation("/api/office-chat/messages/"+id+"/reactions","POST",{emoji,react:!mine});
   onDone();
  }catch(e){setNotice(e instanceof Error?e.message:"Reaction not confirmed")}
  finally{setBusy(false)}
 }
 async function togglePin(){
  setBusy(true);setNotice("");
  try{
   await mutation("/api/office-chat/messages/"+id+"/pin","POST",{pin:!pinned});
   onDone();setNotice(pinned?"Pin removed":"Pinned for this conversation");
  }catch(e){setNotice(e instanceof Error?e.message:"Pin not confirmed")}
  finally{setBusy(false)}
 }
 async function toggleHistory(){
  if(historyOpen){setHistoryOpen(false);return;}
  setHistoryOpen(true);
  setHistoryBusy(true);setNotice("");
  try{
   setHistory(await mutation<RevisionResponse>("/api/office-chat/messages/"+id+"/revisions","GET"));
  }catch(e){
   setHistory(null);setNotice(e instanceof Error?e.message:"Revision history unavailable");
  }finally{setHistoryBusy(false);}
 }
 async function report(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(reportDetail.trim().length<10)return;
  setBusy(true);setNotice("");
  try{
   await mutation("/api/office-ethics","POST",{
    action:"REPORT",category:reportCategory,severity:reportSeverity,
    title:"Connect message conduct or safety report",
    report:reportDetail.trim()+"\n\nMessage reference: "+id+
      "\nChat history remains private and requires separate membership authority.",
    evidence:"/office/chat/threads/"+id,
   });
   setReportOpen(false);setReportDetail("");
   setNotice("Confidential report recorded in the independent Ethics case system.");
  }catch(e){setNotice(e instanceof Error?e.message:"Confidential report not confirmed")}
  finally{setBusy(false)}
 }
 async function del(){
  setBusy(true);setNotice("");
  try{await mutation("/api/office-chat/messages/"+id,"DELETE");
    setRemove(false);onDone();}
  catch(e){setNotice(e instanceof Error?e.message:"Deletion not confirmed")}
  finally{setBusy(false)}
 }
 return <div className={styles.actions} data-chat-message-actions="true" data-open={isOpen}>
  <button ref={anchorRef} className={styles.menuTrigger} data-chat-action-trigger="true" type="button" title="Message actions"
    aria-label="Message actions" aria-expanded={isOpen} aria-controls={"office-message-actions-"+id}
    onClick={toggleMenu}><MoreHorizontal size={17}/></button>
  {expanded&&typeof document!=="undefined"?createPortal(
   <section ref={floatingRef} className={styles.floating} data-chat-action-popover="true"
    data-ui-theme={anchorRef.current?.closest("[data-ui-theme]")?.getAttribute("data-ui-theme")==="light"?"light":"dark"}
    role="dialog" aria-label="Message options">
  {isOpen?<nav className={styles.floatingNav} data-chat-action-menu="true"
   id={"office-message-actions-"+id} aria-label="Message actions">
   <button type="button" aria-label="Message information" title="Message information"
     aria-expanded={infoOpen} onClick={()=>setInfoOpen(v=>!v)}>
     <History size={16}/><span>Message details</span>
   </button>
   <Link href={"/office/chat/threads/"+id} aria-label="Reply in thread" title="Reply in thread"><CornerDownRight size={16}/><span>Reply in thread</span></Link>
   <button type="button" aria-label="Copy message text" title="Copy" onClick={()=>void copyText()}>
     <Copy size={16}/><span>Copy text</span>
   </button>
   <button type="button" aria-label="Save message" title="Save" disabled={busy}
     onClick={()=>void save()}><Bookmark size={16}/><span>Save message</span></button>
   {canPin?<button type="button" aria-label={pinned?"Unpin message":"Pin message"} title={pinned?"Unpin":"Pin"}
     disabled={busy} onClick={()=>void togglePin()}>{pinned?<PinOff size={16}/>:<Pin size={16}/>}<span>{pinned?"Unpin":"Pin message"}</span></button>:null}
   {own?<button type="button" aria-label="Edit message" title="Edit" disabled={busy}
     onClick={()=>{setDraft(body);setEditing(true);setRemove(false);}}><Edit3 size={16}/><span>Edit</span></button>:null}
   {own?<button type="button" aria-label="Remove message" title="Remove" disabled={busy}
     onClick={()=>{setRemove(true);setEditing(false);}}><Trash2 size={16}/><span>Remove</span></button>:null}
   {editedAt?<button type="button" aria-label="Message edit history" title="History"
     disabled={busy} aria-expanded={historyOpen} onClick={()=>void toggleHistory()}><History size={16}/><span>Edit history</span></button>:null}
   <button type="button" aria-label="Confidentially report message" title="Report" disabled={busy}
     aria-expanded={reportOpen}
     onClick={()=>{setReportOpen(open=>!open);setEditing(false);setRemove(false);}}><Flag size={16}/><span>Report</span></button>
   <button type="button" aria-label="React to message" title="React" aria-expanded={reactionsExpanded}
     disabled={busy} onClick={()=>setReactionsExpanded(v=>!v)}><SmilePlus size={16}/><span>React</span></button>
  </nav>:null}
  {infoOpen&&isOpen?<section className={styles.details} data-chat-action-details="true" aria-label="Message information">
    <strong>Message details</strong>
    {sentAt?<time dateTime={sentAt}>{new Date(sentAt).toLocaleString("en-IN",{
      dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"})}</time>:
      <span>Timestamp unavailable</span>}
    <span>{own?"Sent by you":"Received in this conversation"}</span>
    <span>{editedAt?"Edited message":"Original text"} · {pinned?"Pinned":"Not pinned"}</span>
    <small>Delivery ticks appear beside your messages once confirmed.</small>
    <button type="button" onClick={()=>setInfoOpen(false)}>Back to actions</button>
  </section>:null}
  {reactionsExpanded?<div className={styles.reactions} role="group" aria-label="Message reactions">
   {["👍","❤️","✅","🎉","👀","🤔"].map(emoji=>{
    const current=reactions.find(reaction=>reaction.emoji===emoji);
    return <button type="button" key={emoji} disabled={busy}
      aria-label={(current?.mine?"Remove your ":"Add ")+"reaction "+emoji+(current?" · "+current.count+" total":"")}
      aria-pressed={current?.mine??false} title={"React "+emoji}
      onClick={()=>void react(emoji,current?.mine??false)}>{emoji}
      {current?.count?<span aria-hidden="true">{current.count}</span>:null}</button>;
   })}
  </div>:null}
  {reportOpen?<form className={styles.form} aria-label="Report a message" onSubmit={report}>
   <h3>Confidential Ethics report</h3>
   <p>The report is stored in the separate Ethics case system. Investigators do not gain access to this private conversation automatically.</p>
   <div className={styles.reportFields}>
    <label>Concern<select value={reportCategory} onChange={e=>setReportCategory(e.target.value)}>
     {["CODE_OF_CONDUCT","HARASSMENT","DISCRIMINATION","FRAUD","BRIBERY",
       "CONFLICT_OF_INTEREST","DATA_MISUSE","SECURITY","RETALIATION","SAFETY","OTHER"
     ].map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}
    </select></label>
    <label>Severity<select value={reportSeverity} onChange={e=>setReportSeverity(e.target.value)}>
      {["LOW","MEDIUM","HIGH","CRITICAL"].map(value=><option key={value}>{value}</option>)}
    </select></label>
   </div>
   <label>Explain your concern<textarea required rows={4} minLength={10} maxLength={28000}
      value={reportDetail} onChange={e=>setReportDetail(e.target.value)}
      placeholder="Describe your concern. Do not include passwords, OTP codes or sensitive credentials."/></label>
   <div><button type="button" disabled={busy} onClick={()=>setReportOpen(false)}>Cancel</button>
   <button type="submit" disabled={busy||reportDetail.trim().length<10}>
    {busy?"Submitting…":"Submit to Ethics"}</button></div>
   <Link href="/office/ethics">Open my Ethics cases</Link>
  </form>:null}
  {historyOpen?<section className={styles.history} aria-label="Previous message versions" aria-live="polite">
   <h3>Revision history</h3>
   {historyBusy?<p>Checking current membership and history…</p>:null}
   {!historyBusy&&history?<ol>{history.previous_versions.map(version=><li key={version.id}>
     <time dateTime={version.revised_at}>{new Date(version.revised_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</time>
     <p>{version.body}</p>
   </li>)}</ol>:null}
   {!historyBusy&&history&&!history.previous_versions.length?<p>No previous text versions recorded.</p>:null}
   <button type="button" onClick={()=>setHistoryOpen(false)}>Close history</button>
  </section>:null}
  {editing?<form className={styles.form} onSubmit={edit}>
    <label>Edit your message (15 minute window)<textarea required maxLength={4000} minLength={1}
       rows={3} value={draft} onChange={e=>setDraft(e.target.value)}/></label>
    <div><button type="button" onClick={()=>setEditing(false)} disabled={busy}>Cancel</button>
     <button type="submit" disabled={busy||!draft.trim()}>{busy?"Saving…":"Save revision"}</button></div>
   </form>:null}
  {remove?<div className={styles.confirm} role="alertdialog" aria-label="Confirm message removal">
    <p>Hide this message from the conversation? An audit trail and legal retention controls remain.</p>
    <div><button type="button" disabled={busy} onClick={()=>setRemove(false)}>Cancel</button>
     <button type="button" disabled={busy} onClick={()=>void del()}>{busy?"Removing…":"Confirm removal"}</button></div>
  </div>:null}
  {notice?<p role="status" className={styles.floatingNotice}>{notice}</p>:null}
   </section>,document.body):null}
 </div>;
}
