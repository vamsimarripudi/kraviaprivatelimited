"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageSquareText, RefreshCw, Search, Send, Paperclip, Pin, UsersRound } from "lucide-react";
import styles from "./office-connect.module.css";
import { OfficeConnectMessageActions } from "@/components/office-connect-message-actions";
import { OfficeConnectOverview } from "@/components/office-connect-overview";
import { OfficeConnectMembers } from "@/components/office-connect-members";
import { Office5FileCard, type Office5FileStatus } from "@/components/office5-primitives";
import { useOfficeWorkspace } from "@/components/office-workspace-context";
import {mergeChatHistory,type ChatHistoryCursor} from "@/lib/office/chat-history";
import {useOfficeChatLive} from "@/lib/office/use-office-chat-live";

type Conversation = { id: string; kind: string; title: string; department_code?: string | null; updated_at: string };
type Message = { id: string; sender_user_id: string; sender_name: string; body: string; created_at: string; edited_at?: string | null; pinned?:boolean;
 reactions?:{emoji:string;count:number;mine:boolean}[];
 attachments?: {id:string;name:string;mime:string;size:number}[] };
type SelectedFile={id?:string;key:string;name:string;status:Office5FileStatus;message?:string};
type ListResponse = { actor_user_id: string; conversations: Conversation[] };
type Member={user_id:string;display_name:string};
type MessageResponse = { actor_user_id: string; can_pin:boolean; messages: Message[];older_cursor:ChatHistoryCursor|null };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const result = await response.json().catch(() => ({})) as T & { detail?: string };
  if (!response.ok) throw new Error(result.detail || (response.status === 403 ? "Access is restricted" : "The requested operation failed"));
  return result;
}

export function OfficeConnect({ initialConversationId }: { initialConversationId?: string }) {
  const {identity}=useOfficeWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [actor, setActor] = useState("");
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageScope,setMessageScope]=useState<string|null>(null);
  const [olderCursor,setOlderCursor]=useState<ChatHistoryCursor|null>(null);
  const [olderLoading,setOlderLoading]=useState(false);
  const [olderError,setOlderError]=useState("");
  const conversationRef=useRef<string|null>(null);
  const historyInitialized=useRef(false);
  const timelineRef=useRef<HTMLDivElement|null>(null);
  const scrollIntent=useRef<"initial"|"older"|null>(null);
  const scrollAnchor=useRef<{top:number;height:number}|null>(null);
  const [canPin,setCanPin]=useState(false);
  const [messageError, setMessageError] = useState("");
  const [messageLoading, setMessageLoading] = useState(!!initialConversationId);
  const [reloadCount, setReloadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [selectedFiles,setSelectedFiles] = useState<SelectedFile[]>([]);
  const [fileLoading,setFileLoading] = useState(false);
  const [members,setMembers] = useState<Member[]>([]);
  const [memberPanel,setMemberPanel]=useState(false);
  const [pickedMentions,setPickedMentions] = useState<string[]>([]);
  const [mentionPicker,setMentionPicker] = useState(false);
  const nonce = useRef<string | null>(null);
  const activeId = initialConversationId;
  const live=useOfficeChatLive(activeId,
    ()=>setReloadCount(count=>count+1),
    ()=>{setMessageError("Conversation access has changed. Reload after authorization is restored.");
      setMessages([]);setMessageScope(null);setReloadCount(count=>count+1);});
  const selected = conversations.find(row => row.id === activeId);
  const visibleMessages=messageScope===activeId?messages:[];
  const waitingMessage=!messageError&&(messageLoading||messageScope!==activeId);
  useLayoutEffect(()=>{
   const el=timelineRef.current;
   if(!el||!scrollIntent.current)return;
   if(scrollIntent.current==="initial")el.scrollTop=el.scrollHeight;
   else if(scrollAnchor.current)el.scrollTop=scrollAnchor.current.top+
     el.scrollHeight-scrollAnchor.current.height;
   scrollIntent.current=null;scrollAnchor.current=null;
  },[messages]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const result = await json<ListResponse>("/api/office-chat/conversations");
        if (!live) return;
        setConversations(result.conversations);
        setActor(result.actor_user_id);
        setListError("");
      } catch (error) {
        if (live) setListError(error instanceof Error ? error.message : "Unable to load conversations");
      } finally {
        if (live) setListLoading(false);
      }
    };
    void load();
    return () => { live = false; };
  }, [reloadCount]);

  useEffect(() => {
    if(!activeId)return;
    let live=true;
    void json<{members:Member[]}>("/api/office-chat/conversations/"+encodeURIComponent(activeId)+"/members")
      .then(data=>{if(live)setMembers(data.members.filter(m=>m.user_id!==actor));})
      .catch(()=>{if(live)setMembers([]);});
    return()=>{live=false;};
  },[activeId,actor]);

  useEffect(() => {
    if(!activeId)return;
    let live=true;
    let inFlight=false;
    if(conversationRef.current!==activeId){
      conversationRef.current=activeId;
      historyInitialized.current=false;
      setMessages([]);setMessageScope(null);setOlderCursor(null);
      setOlderError("");setMessageError("");setMessageLoading(true);
      setMemberPanel(false);setMembers([]);setPickedMentions([]);
    }
    const load=async()=>{
      if(inFlight)return;
      inFlight=true;
      try{
        const response=await json<MessageResponse>("/api/office-chat/conversations/"+
          encodeURIComponent(activeId)+"/messages");
        if(!live||conversationRef.current!==activeId)return;
        if(!historyInitialized.current){
          historyInitialized.current=true;
          scrollIntent.current="initial";
          setMessages(response.messages);
          setOlderCursor(response.older_cursor);
        }else{
          // A short latest page is the entire current conversation. Discard
          // previously cached text that may have since been deleted.
          if(!response.older_cursor){setMessages(response.messages);setOlderCursor(null);}
          else setMessages(existing=>mergeChatHistory(existing,response.messages,"latest"));
        }
        setMessageScope(activeId);
        setCanPin(response.can_pin===true);
        setActor(response.actor_user_id);
        setMessageError("");
        void fetch("/api/office-chat/conversations/"+encodeURIComponent(activeId)+
         "/messages",{method:"PATCH",credentials:"same-origin"});
      }catch(error){
        if(live&&conversationRef.current===activeId){
          setMessages([]);setMessageScope(null);setOlderCursor(null);
          setMessageError(error instanceof Error?error.message:"Unable to load messages");
        }
      }finally{
        inFlight=false;
        if(live)setMessageLoading(false);
      }
    };
    void load();
    const interval=window.setInterval(()=>{
      if(document.visibilityState==="visible")void load();
    },15000);
    return()=>{live=false;window.clearInterval(interval);};
  }, [activeId, reloadCount]);


  async function loadOlder(){
    if(!activeId||!olderCursor||olderLoading||messageScope!==activeId)return;
    const currentId=activeId;
    setOlderLoading(true);setOlderError("");
    const node=timelineRef.current;
    if(node)scrollAnchor.current={top:node.scrollTop,height:node.scrollHeight};
    try{
      const query=new URLSearchParams({before_at:olderCursor.at,before_id:olderCursor.id});
      const response=await json<MessageResponse>("/api/office-chat/conversations/"+
        encodeURIComponent(currentId)+"/messages?"+query.toString());
      if(conversationRef.current!==currentId)return;
      scrollIntent.current="older";
      setMessages(existing=>mergeChatHistory(existing,response.messages,"older"));
      setOlderCursor(response.older_cursor);
      setMessageError("");
    }catch(error){
      scrollAnchor.current=null;
      setOlderError(error instanceof Error?error.message:"Older messages unavailable");
    }finally{setOlderLoading(false);}
  }

  async function uploadFile(file:File) {
    if(!activeId)return;
    const key=window.crypto.randomUUID();
    const entry:SelectedFile={key,name:file.name,status:"selected"};
    setSelectedFiles(prev=>[...prev,entry]);
    if(file.size<1||file.size>10_485_760){
      setSelectedFiles(prev=>prev.map(f=>f.key===key?{...f,status:"blocked",message:"File must be 1 byte–10 MiB"}:f));
      return;
    }
    setFileLoading(true);
    setSelectedFiles(prev=>prev.map(f=>f.key===key?{...f,status:"uploading"}:f));
    try{
      const form=new FormData();
      form.set("conversation_id",activeId);
      form.set("file",file);
      const response=await fetch("/api/office-chat/attachments/prepare",{
        method:"POST",credentials:"same-origin",body:form,
      });
      const body=await response.json().catch(()=>({})) as {attachment_id?:string;status?:string;detail?:string};
      if(!response.ok)throw new Error(body.detail??"Private file upload not confirmed");
      setSelectedFiles(prev=>prev.map(f=>f.key===key?{
        ...f,id:body.attachment_id,status:body.status==="CLEAN"?"available":"unknown",
        message:body.status==="CLEAN"?"Malware scanner confirmed clean":body.detail??"Scan pending; download blocked",
      }:f));
    }catch(e){
      setSelectedFiles(prev=>prev.map(f=>f.key===key?{
        ...f,status:"failed",message:e instanceof Error?e.message:"Upload failed",
      }:f));
    }finally{setFileLoading(false);}
  }

  async function retryAttachment(id:string){
    setSelectedFiles(prev=>prev.map(f=>f.id===id?{...f,status:"scanning"}:f));
    try{
      const response=await fetch("/api/office-chat/attachments/"+id+"/retry",{
        method:"POST",credentials:"same-origin",
      });
      const body=await response.json().catch(()=>({})) as {status?:string;detail?:string};
      if(!response.ok)throw new Error(body.detail??"Scanner did not verify the file");
      setSelectedFiles(prev=>prev.map(f=>f.id===id?{
        ...f,status:body.status==="CLEAN"?"available":"unknown",message:body.detail??"Private scan verified",
      }:f));
    }catch(e){
      setSelectedFiles(prev=>prev.map(f=>f.id===id?{
        ...f,status:"unknown",message:e instanceof Error?e.message:"Scan remains unconfirmed",
      }:f));
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || submitting || fileLoading || selectedFiles.some(file=>file.status!=="available")) return;
    setSubmitting(true);
    setSendStatus("");
    nonce.current ??= window.crypto.randomUUID();
    try {
      await json<{ message_id: string }>("/api/office-chat/conversations/" + encodeURIComponent(activeId) + "/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), client_nonce: nonce.current, mention_user_ids:pickedMentions, attachment_ids:selectedFiles.map(f=>f.id).filter(Boolean) }),
      });
      nonce.current = null;
      setDraft("");setPickedMentions([]);setMentionPicker(false);setSelectedFiles([]);
      setSendStatus("Message stored in the private conversation");
      setReloadCount(value => value + 1);
    } catch (error) {
      setSendStatus(error instanceof Error ? error.message : "Message not confirmed; your draft has been preserved");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className={styles.connect} aria-label="KRAVIA Connect">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>KRAVIA OFFICE · CONNECT</p>
        <h1>{activeId ? selected?.title ?? "Private conversation" : "Communication home"}</h1>
        <p>Employee-only conversations. Formal approvals, access grants and payments remain in their governed systems.</p></div>
      <div className={styles.headerActions}>
        <Link href="/office/chat/directory"><Search size={17} aria-hidden="true"/>Find employee</Link>
        <Link href="/office/chat/groups/new"><MessageSquareText size={17} aria-hidden="true"/>Create group</Link>
        {identity.department?<Link href={"/office/chat/channels/"+identity.department.toLowerCase()}>
          <MessageSquareText size={17} aria-hidden="true"/>My department</Link>:null}
        <button type="button" onClick={() => setReloadCount(v => v + 1)} aria-label="Refresh Connect" title="Refresh"><RefreshCw size={17}/></button>
      </div>
    </header>
    <div className={styles.grid} data-home={!activeId}>
      <aside className={styles.sidebar} aria-label="Conversations">
        <div className={styles.sideHeading}><h2>My conversations</h2><span>{listLoading?"…":listError?"—":conversations.length}</span></div>
        {listLoading ? <div className={styles.skeleton} role="status">Loading authorized conversations…</div> : null}
        {listError ? <div className={styles.error} role="alert"><p>{listError}</p><button type="button" onClick={() => setReloadCount(n => n + 1)}>Retry</button></div> : null}
        {!listLoading && !listError && !conversations.length
          ? <div className={styles.empty}><MessageSquareText size={22} aria-hidden="true"/><p>No conversations yet.</p><Link href="/office/chat/directory">Start a private conversation</Link></div>
          : null}
        <nav className={styles.conversations} aria-label="Conversation list">
          {conversations.map(item => <Link key={item.id}
            href={item.kind === "DEPARTMENT" && item.department_code
              ? "/office/chat/channels/" + encodeURIComponent(item.department_code.toLowerCase())
              : (item.kind === "GROUP" ? "/office/chat/groups/" : "/office/chat/dm/") + item.id}
            aria-current={item.id === activeId ? "page" : undefined}>
            <span className={styles.avatar} aria-hidden="true">{item.title.trim().charAt(0).toUpperCase() || "K"}</span>
            <span className={styles.conversationName}><strong>{item.title}</strong><small>{item.kind === "DM" ? "Private · members only" : item.kind}</small></span>
            <ArrowRight size={15} aria-hidden="true"/></Link>)}
        </nav>
      </aside>
      <section className={styles.body} data-home={!activeId} aria-label={activeId ? "Private messages" : "Connect workspace"}>
        {!activeId ? <OfficeConnectOverview conversations={conversations} conversationsLoading={listLoading} conversationsError={listError}/> : <>
          <div className={styles.threadHeader}><Link href="/office/chat" className={styles.back}><ArrowLeft size={17}/>All conversations</Link>
             <span className={styles.liveStatus} data-state={live} aria-live="polite" role="status">
              {live==="live"?"Live updates · private":live==="reconnecting"?"Live stream reconnecting":
                live==="restricted"?"Conversation access revoked":"Private refresh · fallback"}
             </span>
             <button type="button" aria-expanded={memberPanel} aria-controls="office-connect-members"
              onClick={()=>setMemberPanel(open=>!open)}><UsersRound size={16} aria-hidden="true"/>Members</button></div>
          {memberPanel?<OfficeConnectMembers key={activeId} conversationId={activeId} onChanged={()=>setReloadCount(n=>n+1)}/>:null}
          <div ref={timelineRef} className={styles.timeline} role="log" aria-label="Message history" aria-live="polite">
            {waitingMessage ? <div className={styles.skeleton} role="status">Opening authorized history…</div> : null}
            {messageError ? <div className={styles.error} role="alert"><p>{messageError}</p>
              <button type="button" onClick={() => setReloadCount(v=>v+1)}>Retry</button></div> : null}
            {!waitingMessage&&!messageError&&olderCursor?<button type="button"
             className={styles.olderButton} disabled={olderLoading}
             onClick={()=>void loadOlder()}>{olderLoading?"Loading earlier history…":"Load older messages"}</button>:null}
            {olderError?<p role="alert" className={styles.olderError}>{olderError}
             <button type="button" disabled={olderLoading} onClick={()=>void loadOlder()}>Retry</button></p>:null}
            {!waitingMessage && !messageError && !visibleMessages.length ? <div className={styles.empty}>No messages yet. Start the conversation below.</div> : null}
            {visibleMessages.map(message => <article key={message.id} className={styles.message} data-own={message.sender_user_id === actor}>
              <strong>{message.sender_user_id === actor ? "You" : message.sender_name}</strong>
              {message.pinned?<span className={styles.pinned}><Pin size={13} aria-hidden="true"/>Pinned in this conversation</span>:null}
              <p>{message.body}</p>
              <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
              {message.attachments?.length?<div className={styles.messageFiles} aria-label="Scanned shared attachments">
                {message.attachments.map(file=><a key={file.id}
                  href={"/api/office-chat/attachments/"+file.id+"/download"}><Paperclip size={14}/>
                  {file.name} · {Math.ceil(file.size/1024)} KiB</a>)}
              </div>:null}
              <OfficeConnectMessageActions id={message.id} body={message.body} editedAt={message.edited_at}
                pinned={message.pinned} canPin={canPin} reactions={message.reactions??[]} own={message.sender_user_id===actor} onDone={()=>setReloadCount(v=>v+1)}/>
            </article>)}
          </div>
          <form className={styles.composer} onSubmit={send}>
            <label htmlFor="office-chat-message">Message</label>
            <div><textarea id="office-chat-message" value={draft} maxLength={4000} rows={2}
              placeholder="Write a message for verified participants…" disabled={submitting || !!messageError}
              onChange={event => { nonce.current = null; setDraft(event.target.value); setSendStatus(""); }}
              onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.form?.requestSubmit(); }}/>
              <button type="submit" disabled={!draft.trim() || submitting || fileLoading || selectedFiles.some(file=>file.status!=="available") || !!messageError}><Send size={16}/> {submitting ? "Sending…" : "Send"}</button>
            </div>
            <div className={styles.attachmentControls}>
              <label htmlFor="office-chat-file"><Paperclip size={16}/> Attach scanned file</label>
              <input id="office-chat-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={fileLoading||submitting||selectedFiles.length>=5} onChange={e=>{
                  const file=e.target.files?.[0];e.target.value="";if(file)void uploadFile(file);
                }}/>
              <small>PDF/JPEG/PNG/WebP · Max 10 MiB · 5 attachments</small>
            </div>
            {selectedFiles.length?<div className={styles.selectedFiles} aria-label="Attachment status">
              {selectedFiles.map(file=><Office5FileCard key={file.key} name={file.name} status={file.status}
               reason={file.message} onRetry={file.id?()=>void retryAttachment(file.id!):undefined}
               onCancel={()=>setSelectedFiles(prev=>prev.filter(f=>f.key!==file.key))}/>)}
              <p>Files are not shared until their scan is clean and your message is confirmed by the server.</p>
              <button type="button" onClick={()=>setSelectedFiles([])} disabled={submitting}>Clear selected files</button>
            </div>:null}
            <div className={styles.mentionControls}>
              <button type="button" aria-expanded={mentionPicker} aria-controls="office-chat-mention-picker"
               onClick={()=>setMentionPicker(v=>!v)} disabled={submitting}>@ Mention participant</button>
              {pickedMentions.length?<small>{pickedMentions.length} verified mention(s) selected</small>:null}
            </div>
            {mentionPicker?<div id="office-chat-mention-picker" className={styles.mentionPicker} role="group" aria-label="Current conversation participants">
              {members.length?members.map(person=><button key={person.user_id} type="button"
               disabled={pickedMentions.includes(person.user_id)}
               onClick={()=>{
                setPickedMentions(prev=>[...prev,person.user_id]);
                setDraft(prev=>prev.trimEnd()+(prev.trim()?" ":"")+"@"+person.display_name+" ");
                setMentionPicker(false);nonce.current=null;
               }}>{person.display_name}</button>):<span>No other current active members</span>}
            </div>:null}
            {sendStatus ? <p role="status" className={styles.sendStatus}>{sendStatus}</p> : null}
            <small>A stored message is not a formal approval or instruction to execute an action.</small>
          </form>
        </>}
      </section>
    </div>
  </section>;
}
