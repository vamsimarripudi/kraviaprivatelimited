"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {
  ArrowRight,ChevronRight,MessageCircle,MessagesSquare,
  Plus,RefreshCw,Search,UsersRound,
} from "lucide-react";
import type {OfficeInboxLiveState} from "@/lib/office/use-office-chat-inbox-live";
import {useOfficeWorkspace} from "@/components/office-workspace-context";
import {OfficeConnectRoleInbox,type RoleInboxKind} from "@/components/office-connect-role-inbox";
import styles from "./office-connect-chat-list.module.css";

type Conversation={
  id:string;kind:string;title:string;department_code?:string|null;updated_at:string;
};
type UnreadResult={unread_messages:number;unread_conversations:number;conversations:Array<{conversation_id:string;unread:number}>};
type Filter="all"|"unread"|"groups";

export function chatConversationHref(item:Conversation) {
  if(item.kind==="DEPARTMENT"&&item.department_code)
    return "/office/chat/channels/"+encodeURIComponent(item.department_code.toLowerCase());
  return (item.kind==="GROUP"?"/office/chat/groups/":"/office/chat/dm/")+item.id;
}
function dateLabel(value:string){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  return new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short"}).format(date);
}

export function OfficeConnectChatList({
  conversations,activeId,loading,error,liveRevision,liveState,onRefresh,
}:{
  conversations:Conversation[];
  activeId?:string;
  loading:boolean;error:string;liveRevision:number;liveState:OfficeInboxLiveState;
  onRefresh:()=>void;
}){
  const {permissions}=useOfficeWorkspace();
  const showIT=permissions.includes("it.service.manage")||permissions.includes("it.service.read");
  const showSupport=permissions.includes("support.case.read")||permissions.includes("support.case.manage");
  const [workspaceMode,setWorkspaceMode]=useState<"chats"|RoleInboxKind>("chats");
  const [filter,setFilter]=useState<Filter>("all");
  const [query,setQuery]=useState("");
  const [unread,setUnread]=useState<UnreadResult|null>(null);
  const [unreadState,setUnreadState]=useState<"loading"|"ready"|"unavailable">("loading");
  useEffect(()=>{
    let alive=true;
    const controller=new AbortController();
    void fetch("/api/office-chat/unread",{
      cache:"no-store",credentials:"same-origin",signal:controller.signal,
    }).then(async response=>{
      if(!response.ok)throw new Error("Unread inbox unavailable");
      const value=await response.json() as Partial<UnreadResult>;
      if(!Array.isArray(value.conversations)||typeof value.unread_conversations!=="number")
        throw new Error("Unread source invalid");
      if(alive){
        setUnread({
          unread_messages:Math.max(0,Number(value.unread_messages)||0),
          unread_conversations:Math.max(0,Number(value.unread_conversations)||0),
          conversations:value.conversations,
        });
        setUnreadState("ready");
      }
    }).catch(()=>{
      if(alive){setUnread(null);setUnreadState("unavailable");}
    });
    return()=>{alive=false;controller.abort();};
  },[liveRevision]);

  const byId=useMemo(()=>new Map<string,number>((unread?.conversations??[]).map(item=>[
    item.conversation_id,Math.max(0,Number(item.unread)||0)
  ] as const)),[unread]);
  const shown=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return conversations.filter(c=>
      (!needle||c.title.toLowerCase().includes(needle))&&
      (filter!=="groups"||c.kind==="GROUP")&&
      (filter!=="unread"||(byId.get(c.id)??0)>0));
  },[conversations,byId,filter,query]);
  const canShow=filter!=="unread"||unreadState==="ready";
  return <aside className={styles.sidebar} aria-label="My Chats" data-chat-list>
    <div className={styles.head}>
      <div><span className={styles.kicker}>KRAVIA CONNECT</span><h2>My Chats</h2></div>
      <div className={styles.actions}>
        <Link href="/office/chat/groups/new" aria-label="New group" title="New group"><UsersRound size={18}/></Link>
        <Link href="/office/chat/directory" className={styles.create} aria-label="New message" title="New message"><Plus size={21}/></Link>
      </div>
    </div>
    {showIT||showSupport?<div className={styles.workspaces} role="group" aria-label="Assigned chat workspaces">
      <button type="button" data-active={workspaceMode==="chats"}
        aria-pressed={workspaceMode==="chats"} onClick={()=>setWorkspaceMode("chats")}>
        Chats</button>
      {showIT?<button type="button" data-active={workspaceMode==="it"}
        aria-pressed={workspaceMode==="it"} onClick={()=>setWorkspaceMode("it")}>
        IT tickets</button>:null}
      {showSupport?<button type="button" data-active={workspaceMode==="support"}
        aria-pressed={workspaceMode==="support"} onClick={()=>setWorkspaceMode("support")}>
        Support</button>:null}
    </div>:null}
    {workspaceMode==="chats"?<>
    <div className={styles.searchWrap}>
      <label className={styles.search}>
        <Search size={18} aria-hidden="true"/>
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
          placeholder="Search chats" aria-label="Search your chats"/>
      </label>
      <Link href="/office/chat/search" title="Search message history" aria-label="Search message history">
        <MessagesSquare size={17}/>
      </Link>
    </div>
    <div className={styles.filters} role="group" aria-label="Conversation filters">
      {(["all","unread","groups"] as const).map(option=><button key={option} type="button"
        data-active={filter===option} aria-pressed={filter===option}
        onClick={()=>setFilter(option)}>
        {option==="all"?"All":option==="unread"?"Unread":"Groups"}
        {option==="unread"&&unreadState==="ready"&&unread&&unread.unread_conversations>0?
          <span className={styles.filterCount}>{unread.unread_conversations}</span>:null}
      </button>)}
    </div>
    <div className={styles.chatList} role="region" aria-label="Your conversations" aria-live="polite">
      {loading?<p className={styles.state} role="status">Loading your private chats…</p>:null}
      {error?<div className={styles.state} role="alert"><p>{error}</p>
        <button type="button" onClick={onRefresh}><RefreshCw size={15}/>Retry</button>
      </div>:null}
      {!loading&&!error&&filter==="unread"&&unreadState!=="ready"?
        <div className={styles.state} role="status">Unread status is unavailable.
          <button type="button" onClick={onRefresh}><RefreshCw size={15}/>Retry</button>
        </div>:null}
      {!loading&&!error&&canShow&&shown.length===0?<div className={styles.empty}>
        <MessageCircle size={27} aria-hidden="true"/>
        <strong>{filter==="unread"?"No unread chats":query?"No matching chats":"No chats to show"}</strong>
        {filter==="all"&&!query?<Link href="/office/chat/directory">Start a conversation <ArrowRight size={15}/></Link>:null}
      </div>:null}
      {!loading&&!error&&canShow?shown.map(item=>{
        const count=byId.get(item.id)??0;
        return <Link key={item.id} href={chatConversationHref(item)}
          className={styles.chat} aria-current={item.id===activeId?"page":undefined}>
          <span className={styles.avatar} aria-hidden="true">
            {item.kind==="GROUP"?<UsersRound size={19}/>:item.title.trim().charAt(0).toUpperCase()||"K"}
          </span>
          <span className={styles.chatCopy}>
            <strong>{item.title}</strong>
            <small>{item.kind==="DM"?"Private chat":item.kind==="GROUP"?"Group":"Department"}</small>
          </span>
          <span className={styles.chatMeta}>
            <time dateTime={item.updated_at}>{dateLabel(item.updated_at)}</time>
            {count>0?<b aria-label={count+" unread messages"}>{count>99?"99+":count}</b>:
              <ChevronRight size={16} aria-hidden="true"/>}
          </span>
        </Link>;
      }):null}
    </div>
    </>:<OfficeConnectRoleInbox kind={workspaceMode}/>}
    <div className={styles.foot}>
      <small>{liveState==="restricted"?"Chat access changed":"My conversations"}</small>
      <button type="button" aria-label="Refresh conversations" title="Refresh"
        onClick={onRefresh}><RefreshCw size={17} aria-hidden="true"/></button>
    </div>
  </aside>;
}

export function OfficeConnectWelcome(){
  return <div className={styles.welcome} data-chat-welcome>
    <div className={styles.welcomeArtwork}><MessagesSquare size={48} strokeWidth={1.5} aria-hidden="true"/></div>
    <span className={styles.welcomeKicker}>KRAVIA CONNECT</span>
    <h2>Your conversations</h2>
    <p>Select a chat or start a message.</p>
    <Link href="/office/chat/directory">New message <ArrowRight size={17}/></Link>
    <small></small>
  </div>;
}
