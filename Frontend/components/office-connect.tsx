"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquareText, RefreshCw, Search, Send, Paperclip, Pin, UsersRound, Smile, Image, Video, FileText, FileImage, BookMarked, Plus, X, Check, CheckCheck } from "lucide-react";
import styles from "./office-connect.module.css";
import { OfficeConnectMessageActions } from "@/components/office-connect-message-actions";
import { OfficeActionState } from "@/components/office-action-state";
import { OfficeConnectChatList, OfficeConnectWelcome } from "@/components/office-connect-chat-list";
import { OfficeConnectMobileHome } from "@/components/office-connect-mobile-home";
import { OfficeConnectMembers } from "@/components/office-connect-members";
import { Office5FileCard, type Office5FileStatus } from "@/components/office5-primitives";
import { useOfficeWorkspace } from "@/components/office-workspace-context";
import {mergeChatHistory,type ChatHistoryCursor} from "@/lib/office/chat-history";
import {useOfficeChatLive} from "@/lib/office/use-office-chat-live";
import {useOfficeChatInboxLive} from "@/lib/office/use-office-chat-inbox-live";

type Conversation = { id: string; kind: string; title: string; department_code?: string | null; updated_at: string };
type Message = { id: string; sender_user_id: string; sender_name: string; body: string; created_at: string; edited_at?: string | null; pinned?:boolean; delivery_status?:"sent"|"delivered"|"read";
 reactions?:{emoji:string;count:number;mine:boolean}[];
 attachments?: {id:string;name:string;mime:string;size:number}[] };
type SelectedFile={id?:string;key:string;name:string;status:Office5FileStatus;message?:string};
type ListResponse = { actor_user_id: string; conversations: Conversation[] };
type Member={user_id:string;display_name:string};
type MessageResponse = { actor_user_id: string; can_pin:boolean; messages: Message[];older_cursor:ChatHistoryCursor|null };
type ComposerTool = "attach"|"emoji"|"templates"|null;
type MessageTemplate = {id?:string;title:string;body:string};
const EMOJIS=["😀","😃","😄","😁","😊","😍","😂","🥹","😉","🤔","😎","😮","🙏","👏","👍","👎","❤️","💙","✅","🎉","🔥","⭐","💯","👀","🙌","💡","📌","📎","📅","📢","💬","🚀","🤝","🎯","🌟","☕","🙋","👌","💪","🤗","🎂","🎊"];
const QUICK_TEMPLATES:MessageTemplate[]=[
  {title:"Quick update",body:"Quick update: "},
  {title:"Meeting request",body:"Could we arrange a short meeting to discuss this? Please share your availability."},
  {title:"Status request",body:"Could you share the current status and any blockers when convenient?"},
  {title:"Acknowledgement",body:"Received, thank you. I will review and follow up."},
];
function messageDay(date:string){
 const parsed=new Date(date);
 return Number.isNaN(parsed.valueOf())?"Unknown date":
 new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric"}).format(parsed);
}
function messageTime(date:string){
 const parsed=new Date(date);
 return Number.isNaN(parsed.valueOf())?"":
 new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit",hour12:true}).format(parsed);
}
const MAX_CHAT_UPLOAD_BYTES=4_194_304; // Vercel Function request body is capped at 4.5 MB; reserve multipart overhead.
// Railway has not deployed the new content-signature scanner yet. Allow only the
// four MIME types already supported by the live API until explicitly enabled
// in a separately reviewed production build after its backend release.
const chatExtendedMediaReady=process.env.NEXT_PUBLIC_KRAVIA_CHAT_EXTENDED_MEDIA==="true";
const liveScannerTypes=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);


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
  const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [menuFor,setMenuFor]=useState<string|null>(null);
  function cancelMessageHold(){
    if(holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null;}
  }
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
  const [typingPeople,setTypingPeople]=useState<Member[]>([]);
  const [typingRefresh,setTypingRefresh]=useState(0);
  const lastTypingSignal=useRef(0);
  const typingIdleTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(typingIdleTimer.current)clearTimeout(typingIdleTimer.current);},[initialConversationId]);
  const deliveredIds=useRef<Set<string>>(new Set());
  const lastReadMessage=useRef("");
  const [mentionTerm,setMentionTerm] = useState<string|null>(null);
  const [mentionIndex,setMentionIndex] = useState(0);
  const [composerTool,setComposerTool] = useState<ComposerTool>(null);
  const [templateTitle,setTemplateTitle] = useState("");
  const [customTemplates,setCustomTemplates] = useState<MessageTemplate[]>([]);
  const [pendingMessage,setPendingMessage] = useState<{nonce:string;body:string;created_at:string}|null>(null);
  const composerInput=useRef<HTMLTextAreaElement|null>(null);
  const filePicker=useRef<HTMLInputElement|null>(null);
  const imagePicker=useRef<HTMLInputElement|null>(null);
  const videoPicker=useRef<HTMLInputElement|null>(null);
  const gifPicker=useRef<HTMLInputElement|null>(null);

  const nonce = useRef<string | null>(null);
  const activeId = initialConversationId;
  const inboxLive=useOfficeChatInboxLive(()=>setReloadCount(x=>x+1),()=>{
    setConversations([]);setActor("");setMessages([]);setMessageScope(null);
    setListError("Office membership was revoked. Sign in again to restore authorized access.");
  });
  useOfficeChatLive(activeId,
    ()=>setReloadCount(count=>count+1),
    ()=>{setMessageError("Conversation access has changed. Reload after authorization is restored.");
      setMessages([]);setMessageScope(null);setTypingPeople([]);setReloadCount(count=>count+1);},
    ()=>setTypingRefresh(value=>value+1));
  const selected = conversations.find(row => row.id === activeId);
  const visibleMessages=messageScope===activeId?messages:[];
  const mentionSuggestions=mentionTerm===null?[]:members.filter(person=>
    person.display_name.toLocaleLowerCase().includes(mentionTerm.toLocaleLowerCase())).slice(0,8);
  useEffect(()=>{
    if(!actor)return;
    let active=true;
    void json<{templates:MessageTemplate[]}>("/api/office-chat/templates")
      .then(result=>{if(active)setCustomTemplates(result.templates??[]);})
      .catch(()=>{if(active)setCustomTemplates([]);});
    return()=>{active=false;};
  },[actor]);

  function updateDraft(value:string,caret:number){
    nonce.current=null;setDraft(value);setSendStatus("");
    const token=value.slice(0,caret).match(/(?:^|\s)@([\p{L}\p{N} ._-]{0,42})$/u);
    setMentionTerm(token?token[1]:null);setMentionIndex(0);
    setPickedMentions(existing=>existing.filter(id=>members.some(person=>
      person.user_id===id&&value.includes("@"+person.display_name))));
    if(typingIdleTimer.current)clearTimeout(typingIdleTimer.current);
    signalTyping(Boolean(value.trim()));
    if(value.trim())typingIdleTimer.current=setTimeout(()=>signalTyping(false),2200);
  }
  function insertText(value:string,replaceMention=false){
    const field=composerInput.current;
    const start=field?.selectionStart??draft.length;
    const end=field?.selectionEnd??draft.length;
    const prefix=draft.slice(0,start);
    const mention=replaceMention?prefix.match(/(?:^|\s)@([\p{L}\p{N} ._-]{0,42})$/u):null;
    const from=mention?start-mention[0].length+(mention[0].startsWith(" ")?1:0):start;
    const result=draft.slice(0,from)+value+draft.slice(end);
    setDraft(result);setMentionTerm(null);setComposerTool(null);nonce.current=null;
    if(typingIdleTimer.current)clearTimeout(typingIdleTimer.current);
    signalTyping(Boolean(result.trim()));
    if(result.trim())typingIdleTimer.current=setTimeout(()=>signalTyping(false),2200);
    window.requestAnimationFrame(()=>{
      field?.focus();const cursor=from+value.length;field?.setSelectionRange(cursor,cursor);
    });
  }
  function chooseMention(person:Member){
    insertText("@"+person.display_name+" ",true);
    setPickedMentions(ids=>ids.includes(person.user_id)?ids:[...ids,person.user_id]);
  }
  async function saveCustomTemplate(){
    const name=templateTitle.trim();
    if(!actor||!name||!draft.trim())return;
    try{
      const response=await json<{template:MessageTemplate}>("/api/office-chat/templates",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"SAVE",title:name,body:draft.trim()})
      });
      setCustomTemplates(templates=>[response.template,
        ...templates.filter(t=>t.title!==response.template.title)].slice(0,12));
      setTemplateTitle("");setComposerTool(null);
      setSendStatus("Personal template saved to your private Office account");
    }catch(error){setSendStatus(error instanceof Error?error.message:"Template not saved");}
  }
  async function deleteCustomTemplate(template:MessageTemplate){
    if(!template.id)return;
    try{
      await json<{deleted:boolean}>("/api/office-chat/templates",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"DELETE",id:template.id})
      });
      setCustomTemplates(items=>items.filter(x=>x.id!==template.id));
    }catch(error){setSendStatus(error instanceof Error?error.message:"Template deletion not confirmed");}
  }


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
        if(live){setConversations([]);setActor("");
          setListError(error instanceof Error?error.message:"Unable to load conversations");}
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
         // Read only when the conversation is actually focused.
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


  useEffect(()=>{
    if(!activeId)return;
    const controller=new AbortController();
    const refreshTyping=async()=>{
      try{
        const result=await fetch("/api/office-chat/conversations/"+
          encodeURIComponent(activeId)+"/typing",{
          credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!result.ok)throw new Error("Typing status unavailable");
        const body=await result.json() as {typing?:Member[]};
        if(!controller.signal.aborted)
          setTypingPeople(Array.isArray(body.typing)?body.typing:[]);
      }catch{if(!controller.signal.aborted)setTypingPeople([]);}
    };
    void refreshTyping();
    const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void refreshTyping();},1700);
    return()=>{controller.abort();window.clearInterval(interval);};
  },[activeId,typingRefresh]);

  useEffect(()=>{
    if(!activeId||!actor||messageScope!==activeId||!visibleMessages.length||messageError)return;
    const ids=visibleMessages.filter(m=>m.sender_user_id!==actor&&!deliveredIds.current.has(m.id))
      .map(m=>m.id).slice(0,100);
    if(!ids.length)return;
    let active=true;
    void fetch("/api/office-chat/conversations/"+encodeURIComponent(activeId)+"/deliver",{
      method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message_ids:ids}),
    }).then(response=>{if(!response.ok)throw Error("Delivery unavailable");
      if(active)ids.forEach(id=>deliveredIds.current.add(id));
    }).catch(()=>{/* Retry on a subsequent authorized refresh. */});
    return()=>{active=false;};
  },[activeId,actor,messageScope,visibleMessages,messageError]);

  useEffect(()=>{
    if(!activeId||!actor||messageScope!==activeId||messageError)return;
    const latest=[...visibleMessages].reverse().find(m=>m.sender_user_id!==actor);
    if(!latest)return;
    const key=activeId+":"+latest.id;
    const acknowledge=()=>{
      if(document.visibilityState!=="visible"||!document.hasFocus()||lastReadMessage.current===key)return;
      const timeline=timelineRef.current;
      // A background tab or a scrolled-up conversation is not proof of reading.
      if(!timeline||timeline.scrollHeight-timeline.scrollTop-timeline.clientHeight>110)return;
      lastReadMessage.current=key;
      void fetch("/api/office-chat/conversations/"+encodeURIComponent(activeId)+"/messages",{
        method:"PATCH",credentials:"same-origin",
      }).then(response=>{if(!response.ok)throw Error("Read unavailable");})
        .catch(()=>{if(lastReadMessage.current===key)lastReadMessage.current="";});
    };
    acknowledge();
    window.addEventListener("focus",acknowledge);
    document.addEventListener("visibilitychange",acknowledge);
    const timeline=timelineRef.current;
    timeline?.addEventListener("scroll",acknowledge,{passive:true});
    return()=>{window.removeEventListener("focus",acknowledge);
      document.removeEventListener("visibilitychange",acknowledge);
      timeline?.removeEventListener("scroll",acknowledge);};
  },[activeId,actor,messageScope,visibleMessages,messageError]);

  function signalTyping(isTyping:boolean){
    if(!activeId||messageError)return;
    const now=Date.now();
    if(isTyping&&now-lastTypingSignal.current<1600)return;
    lastTypingSignal.current=isTyping?now:0;
    void fetch("/api/office-chat/conversations/"+encodeURIComponent(activeId)+"/typing",{
      method:"POST",credentials:"same-origin",keepalive:true,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({typing:isTyping}),
    }).catch(()=>{/* Presence is optional and never blocks message delivery. */});
  }

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
    if(!activeId||selectedFiles.length>=5)return;
    const key=window.crypto.randomUUID();
    const entry:SelectedFile={key,name:file.name,status:"selected"};
    setSelectedFiles(prev=>[...prev,entry]);
    const nativeType=file.type.toLowerCase();
    if(!chatExtendedMediaReady&&!liveScannerTypes.has(nativeType)&&
      !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)){
      setSelectedFiles(prev=>prev.map(f=>f.key===key?{...f,status:"blocked",
        message:"This media type requires the upgraded private scanner; use PDF or a standard photo for now."}:f));
      return;
    }
    if(file.size<1||file.size>MAX_CHAT_UPLOAD_BYTES){
      setSelectedFiles(prev=>prev.map(f=>f.key===key?{...f,status:"blocked",message:"Files must be 1 byte–4 MiB for this secure transfer endpoint"}:f));
      return;
    }
    setComposerTool(null);setFileLoading(true);
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
    if(!activeId||(!draft.trim()&&!selectedFiles.length)||submitting||fileLoading||
      selectedFiles.some(file=>file.status!=="available"))return;
    const body=draft.trim()||"📎 Shared attachment";
    setSubmitting(true);setSendStatus("");setComposerTool(null);setMentionTerm(null);
    nonce.current??=window.crypto.randomUUID();
    const sendingNonce=nonce.current;
    setPendingMessage({nonce:sendingNonce,body,created_at:new Date().toISOString()});
    try{
      const confirmed=await json<{message_id:string}>("/api/office-chat/conversations/"+
        encodeURIComponent(activeId)+"/messages",{
         method:"POST",headers:{"Content-Type":"application/json"},
         body:JSON.stringify({body,client_nonce:sendingNonce,
           mention_user_ids:pickedMentions,attachment_ids:selectedFiles.map(f=>f.id).filter(Boolean)}),
        });
      if(!confirmed.message_id)throw new Error("Server did not confirm the message ID");
      nonce.current=null;
      setMessages(previous=>previous.some(m=>m.id===confirmed.message_id)?previous:[
        ...previous,{id:confirmed.message_id,sender_user_id:actor,
          sender_name:"You",body,created_at:new Date().toISOString()}]);
      setDraft("");
      if(typingIdleTimer.current)clearTimeout(typingIdleTimer.current);
      signalTyping(false);setPickedMentions([]);setSelectedFiles([]);
      setSendStatus("Sent");setReloadCount(v=>v+1);
      scrollIntent.current="initial";
    }catch(error){
      // Keep the actual draft and client nonce for a safe idempotent retry.
      setSendStatus(error instanceof Error?error.message:"Send not confirmed; draft retained");
    }finally{setPendingMessage(null);setSubmitting(false);}
  }

  return <section className={styles.connect} aria-label="KRAVIA Connect" data-thread={!!activeId} data-connect-chat-layout>
    {!activeId ? <OfficeConnectMobileHome
      conversations={conversations} loading={listLoading} error={listError}
      liveRevision={reloadCount} onRefresh={() => setReloadCount(n => n + 1)}/> : null}
    <header className={styles.header} data-chat-home-header>
      <div><p className={styles.eyebrow}>KRAVIA OFFICE · CONNECT</p>
        <h1>{activeId ? selected?.title ?? "Private conversation" : "My Chats"}</h1>
        <p>Authorized conversations with your KRAVIA colleagues.</p></div>
      <div className={styles.headerActions}>
        <Link href="/office/chat/directory" aria-label="Find employee" title="Find employee"><Search size={18}/></Link>
        <Link href="/office/chat/groups/new" aria-label="Create group" title="Create group"><MessageSquareText size={18}/></Link>
        {identity.department?<Link href={"/office/chat/channels/"+identity.department.toLowerCase()}
          aria-label="My department channel" title="Department channel"><UsersRound size={18}/></Link>:null}
        <button type="button" onClick={() => setReloadCount(v => v + 1)}
          aria-label="Refresh Connect" title="Refresh"><RefreshCw size={18}/></button>
      </div>
    </header>
    <div className={styles.grid} data-home={!activeId}>
      <OfficeConnectChatList conversations={conversations} activeId={activeId}
        loading={listLoading} error={listError} liveRevision={reloadCount}
        liveState={inboxLive} onRefresh={() => setReloadCount(v=>v+1)}/>
      <section className={styles.body} data-home={!activeId} data-chat-body aria-label={activeId ? "Private messages" : "Connect workspace"}>
        {!activeId ? <OfficeConnectWelcome/> : <>
          <div className={styles.threadHeader} data-chat-thread-header>
             <Link href="/office/chat" className={styles.back} aria-label="Back to conversations" title="All conversations">
               <ArrowLeft size={17} aria-hidden="true"/></Link>
             <strong>{selected?.title??"Private conversation"}</strong>
             <button type="button" aria-label="Conversation members" title="Members" aria-expanded={memberPanel} aria-controls="office-connect-members"
              onClick={()=>setMemberPanel(open=>!open)}><UsersRound size={17} aria-hidden="true"/></button></div>
          {memberPanel?<OfficeConnectMembers key={activeId} conversationId={activeId} onChanged={()=>setReloadCount(n=>n+1)}/>:null}
          <div ref={timelineRef} className={styles.timeline} data-chat-timeline role="log" aria-label="Message history" aria-live="polite">
            {waitingMessage ? <div className={styles.skeleton} role="status">Opening authorized history…</div> : null}
            {messageError ? <div className={styles.error}><OfficeActionState kind="error" label={messageError} compact/>
              <button type="button" onClick={() => setReloadCount(v=>v+1)}>Retry</button></div> : null}
            {!waitingMessage&&!messageError&&olderCursor?<button type="button"
             className={styles.olderButton} disabled={olderLoading}
             onClick={()=>void loadOlder()}>{olderLoading?"Loading earlier history…":"Load older messages"}</button>:null}
            {olderError?<p role="alert" className={styles.olderError}>{olderError}
             <button type="button" disabled={olderLoading} onClick={()=>void loadOlder()}>Retry</button></p>:null}
            {!waitingMessage && !messageError && !visibleMessages.length ? <div className={styles.empty}>No messages yet. Start the conversation below.</div> : null}
            {visibleMessages.map((message,index) => <Fragment key={message.id}>
             {index===0||messageDay(visibleMessages[index-1].created_at)!==messageDay(message.created_at)?
               <div className={styles.dateDivider} data-chat-day-divider="true" role="separator" aria-label={"Messages on "+messageDay(message.created_at)}>
                 <span>{messageDay(message.created_at)}</span>
               </div>:null}
             <article className={styles.message} data-own={message.sender_user_id === actor}
               data-actions-open={menuFor===message.id}
               onContextMenu={event=>{event.preventDefault();cancelMessageHold();setMenuFor(message.id);}}
               onPointerDown={event=>{if(event.pointerType==="touch"){
                 cancelMessageHold();holdTimer.current=setTimeout(()=>setMenuFor(message.id),520);
               }}}
               onPointerUp={cancelMessageHold} onPointerCancel={cancelMessageHold} onPointerLeave={cancelMessageHold}
               onKeyDown={event=>{if(event.key==="F10"&&event.shiftKey){event.preventDefault();setMenuFor(message.id);}}}>
              <strong>{message.sender_user_id === actor ? "You" : message.sender_name}</strong>
              {message.pinned?<span className={styles.pinned}><Pin size={13} aria-hidden="true"/>Pinned in this conversation</span>:null}
              <div className={styles.messageLine} data-chat-message-line="true">
               <span>{message.body}</span>
               <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
                {message.sender_user_id===actor?<span className={styles.receipt}
                  data-state={message.delivery_status??"sent"} role="img"
                  aria-label={message.delivery_status==="read"?"Read by all":
                    message.delivery_status==="delivered"?"Delivered to all":"Sent"}>
                  {message.delivery_status==="delivered"||message.delivery_status==="read"?
                    <CheckCheck size={14}/>:<Check size={14}/>}
                </span>:null}
              </div>
              {message.attachments?.length?<div className={styles.messageFiles} data-chat-message-files="true" aria-label="Scanned shared attachments">
                {message.attachments.map(file=><div key={file.id} className="chat-inline-media">
                  {["image/jpeg","image/png","image/webp","image/gif"].includes(file.mime)?
                   // Only server-authorized CLEAN linked message attachments may load.
                   <a href={"/api/office-chat/attachments/"+file.id+"/download"} title={"Download "+file.name}>
                    {/* A controlled same-origin binary media preview, never a remote URL. */}
                    <img src={"/api/office-chat/attachments/"+file.id+"/preview"}
                      loading="lazy" decoding="async" alt={"Shared image: "+file.name}/></a>:null}
                  {["video/mp4","video/webm"].includes(file.mime)?
                   <video controls preload="none" playsInline
                     aria-label={"Shared video: "+file.name}>
                    <source src={"/api/office-chat/attachments/"+file.id+"/preview"} type={file.mime}/>
                    Your browser cannot play this video.
                   </video>:null}
                  <a href={"/api/office-chat/attachments/"+file.id+"/download"}>
                   <Paperclip size={14}/>{file.name} · {Math.ceil(file.size/1024)} KiB</a>
                 </div>)}
              </div>:null}
              <OfficeConnectMessageActions id={message.id} body={message.body} editedAt={message.edited_at} sentAt={message.created_at}
                pinned={message.pinned} canPin={canPin} reactions={message.reactions??[]}
                own={message.sender_user_id===actor} menuOpen={menuFor===message.id}
                onToggleMenu={()=>setMenuFor(id=>id===message.id?null:message.id)}
                onDone={()=>setReloadCount(v=>v+1)}/>
             </article>
            </Fragment>)}
            {pendingMessage?<article className={styles.message} data-own="true" data-chat-pending="true">
              <strong>You</strong><div className={styles.messageLine}>
                <span>{pendingMessage.body}</span>
                <time dateTime={pendingMessage.created_at}>{messageTime(pendingMessage.created_at)}</time>
                <span className={styles.sendingMark} aria-label="Sending">Sending…</span>
              </div>
            </article>:null}
          </div>
          {typingPeople.length?<p className={styles.typingNotice} role="status" aria-live="polite">
            <span>{typingPeople.slice(0,2).map(p=>p.display_name).join(", ")}
              {typingPeople.length===1?" is typing":" are typing"}</span>
            <span className={styles.typingDots} aria-hidden="true"><i/><i/><i/></span>
          </p>:null}
          <form className={styles.composer} data-chat-composer onSubmit={send}>
            <label htmlFor="office-chat-message" className="chat-sr-only">Message to verified conversation members</label>
            {mentionTerm!==null?<div className="chat-mention-menu" role="listbox" id="office-chat-mentions" aria-label="Mention group members">
              {mentionSuggestions.length?mentionSuggestions.map((person,index)=>
                <button type="button" role="option" aria-selected={mentionIndex===index} key={person.user_id}
                  onMouseDown={e=>e.preventDefault()} onClick={()=>chooseMention(person)}>
                  {person.display_name}</button>):<p>No matching current members</p>}
            </div>:null}
            {composerTool?<div className="chat-tool-panel" id="office-chat-tool-panel" role="dialog" aria-label="Composer tools">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <strong style={{fontSize:12}}>{composerTool==="attach"?"Attach securely":composerTool==="emoji"?"Insert emoji":"Message templates"}</strong>
                <button type="button" title="Close tools" aria-label="Close tools" onClick={()=>setComposerTool(null)}><X size={15}/></button>
              </div>
              {composerTool==="attach"?<div className="chat-attachment-menu">
                <button type="button" onClick={()=>filePicker.current?.click()}><FileText size={17}/>Documents and files</button>
                <button type="button" onClick={()=>imagePicker.current?.click()}><Image size={17}/>Photos</button>
                <button type="button" disabled={!chatExtendedMediaReady}
                  title={chatExtendedMediaReady?"Attach video":"Requires Railway scanner release"}
                  onClick={()=>videoPicker.current?.click()}><Video size={17}/>Video clips</button>
                <button type="button" disabled={!chatExtendedMediaReady}
                  title={chatExtendedMediaReady?"Attach GIF":"Requires Railway scanner release"}
                  onClick={()=>gifPicker.current?.click()}><FileImage size={17}/>Animated GIF file</button>
                <small>{chatExtendedMediaReady?"Scanner-verified images, GIF, video and documents":
                  "PDF and JPEG/PNG/WebP photos available; other types need the new Railway scanner"}
                  {" · Up to 4 MiB per file · 5 attachments"}</small>
              </div>:null}
              {composerTool==="emoji"?<div className="chat-emoji-grid">
                {EMOJIS.map(emoji=><button key={emoji} type="button" title={emoji}
                  aria-label={"Insert emoji "+emoji} onClick={()=>insertText(emoji)}>{emoji}</button>)}
              </div>:null}
              {composerTool==="templates"?<div className="chat-template-list">
                {QUICK_TEMPLATES.map(t=><button type="button" key={"built-in-"+t.title}
                  onClick={()=>{setDraft(t.body);setComposerTool(null);composerInput.current?.focus();}}>{t.title}</button>)}
                {customTemplates.map(t=><div key={t.id??t.title} style={{display:"flex",alignItems:"center",gap:6}}>
                  <button type="button" style={{flex:1}}
                    onClick={()=>{setDraft(t.body);setComposerTool(null);composerInput.current?.focus();}}>{t.title}</button>
                  <button type="button" title={"Delete "+t.title} aria-label={"Delete "+t.title}
                    onClick={()=>void deleteCustomTemplate(t)}><X size={15}/></button>
                </div>)}
                <div className="chat-template-save">
                  <input aria-label="Name for current draft template" maxLength={60} placeholder="Template title"
                    value={templateTitle} onChange={e=>setTemplateTitle(e.target.value)}/>
                  <button type="button" disabled={!templateTitle.trim()||!draft.trim()} onClick={()=>void saveCustomTemplate()}>Save draft</button>
                </div>
                <small>Personal templates sync with your verified Office account. Do not save passwords or OTPs.</small>
              </div>:null}
            </div>:null}
            <div className="chat-composer-frame">
              <button type="button" className="chat-tool" aria-label="Attach file or media" title="Attach"
                aria-expanded={composerTool==="attach"} aria-controls="office-chat-tool-panel"
                disabled={submitting||fileLoading||selectedFiles.length>=5}
                onClick={()=>{setMentionTerm(null);setComposerTool(v=>v==="attach"?null:"attach");}}>
                <Plus size={20}/></button>
              <textarea id="office-chat-message" ref={composerInput} value={draft} maxLength={4000}
                rows={1} placeholder="Message… type @ to mention a member"
                aria-controls={mentionTerm!==null?"office-chat-mentions":undefined}
                aria-autocomplete="list" disabled={submitting||!!messageError}
                onChange={event=>{
                  const input=event.currentTarget;
                  updateDraft(input.value,input.selectionStart);
                  input.style.height="auto";
                  input.style.height=Math.min(144,Math.max(40,input.scrollHeight))+"px";
                }}
                onBlur={()=>{if(typingIdleTimer.current)clearTimeout(typingIdleTimer.current);signalTyping(false);}}
                onKeyDown={event=>{
                  if(mentionTerm!==null&&mentionSuggestions.length){
                    if(event.key==="ArrowDown"){event.preventDefault();setMentionIndex(i=>(i+1)%mentionSuggestions.length);return;}
                    if(event.key==="ArrowUp"){event.preventDefault();setMentionIndex(i=>(i+mentionSuggestions.length-1)%mentionSuggestions.length);return;}
                    if(event.key==="Enter"||event.key==="Tab"){event.preventDefault();chooseMention(mentionSuggestions[mentionIndex]??mentionSuggestions[0]);return;}
                  }
                  if(event.key==="Escape"){setMentionTerm(null);setComposerTool(null);return;}
                  if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){
                    event.preventDefault();event.currentTarget.form?.requestSubmit();
                  }
                }}/>
              <button type="button" className="chat-tool" aria-label="Choose emoji" title="Emoji"
                aria-expanded={composerTool==="emoji"} onClick={()=>{setMentionTerm(null);setComposerTool(v=>v==="emoji"?null:"emoji");}}>
                <Smile size={19}/></button>
              <button type="button" className="chat-tool" aria-label="Choose GIF"
                title={chatExtendedMediaReady?"Choose GIF":"GIF uploads require the new Railway scanner"}
                disabled={!chatExtendedMediaReady} onClick={()=>gifPicker.current?.click()}><FileImage size={19}/></button>
              <button type="button" className="chat-tool" aria-label="Message templates" title="Templates"
                aria-expanded={composerTool==="templates"} onClick={()=>{setMentionTerm(null);setComposerTool(v=>v==="templates"?null:"templates");}}>
                <BookMarked size={18}/></button>
              <button type="submit" className="chat-tool chat-send" aria-label={submitting?"Sending message":"Send message"}
                title="Send · Enter" disabled={(!draft.trim()&&!selectedFiles.length)||submitting||fileLoading||
                  selectedFiles.some(file=>file.status!=="available")||!!messageError}>
                <Send size={18} aria-hidden="true"/></button>
            </div>
            <div id="office-chat-file-picker" className="chat-sr-only" aria-hidden="true">Private attachment selections</div>
            <input className="chat-file-input" ref={filePicker} type="file" aria-label="Choose a scanned file"
              accept={chatExtendedMediaReady?".pdf,.txt,.docx,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm":
                ".pdf,.jpg,.jpeg,.png,.webp"}
              onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void uploadFile(file);}}/>
            <input className="chat-file-input" ref={imagePicker} type="file" aria-label="Choose an image"
              accept={chatExtendedMediaReady?"image/jpeg,image/png,image/webp,image/gif":
                "image/jpeg,image/png,image/webp"} 
              onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void uploadFile(file);}}/>
            <input className="chat-file-input" ref={videoPicker} type="file" aria-label="Choose a video"
              disabled={!chatExtendedMediaReady} accept="video/mp4,video/webm" 
              onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void uploadFile(file);}}/>
            <input className="chat-file-input" ref={gifPicker} type="file" aria-label="Choose a GIF"
              disabled={!chatExtendedMediaReady} accept="image/gif,.gif"
              onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void uploadFile(file);}}/>
            {selectedFiles.length?<div className="chat-file-queue" aria-label="Attachment scan status">
              {selectedFiles.map(file=><Office5FileCard key={file.key} name={file.name} status={file.status}
                reason={file.message} onRetry={file.id?()=>void retryAttachment(file.id!):undefined}
                onCancel={()=>setSelectedFiles(prev=>prev.filter(f=>f.key!==file.key))}/>)}
            </div>:null}
            <div className="chat-composer-foot">
              <span>{sendStatus||"Enter to send · Shift+Enter for a new line"}</span>
              <span>Private message · not an approval</span>
            </div>
          </form>
        </>}
      </section>
    </div>
  </section>;
}
