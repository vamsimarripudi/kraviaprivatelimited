"use client";

import {useEffect, useMemo, useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Bell, Bookmark, ChevronRight, House, Menu,
  MessageCircle, MoreHorizontal, Plus, RefreshCw, Search, Settings2,
  UsersRound, X,
} from "lucide-react";
import styles from "./office-connect-mobile-home.module.css";
import {useOfficeWorkspace} from "@/components/office-workspace-context";
import {OfficeConnectRoleInbox,type RoleInboxKind} from "@/components/office-connect-role-inbox";

type Conversation = {
  id: string; kind: string; title: string;
  department_code?: string | null; updated_at: string;
};
type UnreadSnapshot = {
  unread_messages: number;
  unread_conversations: number;
  conversations: Array<{conversation_id: string; unread: number}>;
};
type UnreadState = "loading" | "ready" | "restricted" | "unavailable";

function conversationUrl(item: Conversation) {
  if (item.kind === "DEPARTMENT" && item.department_code) {
    return "/office/chat/channels/" + encodeURIComponent(item.department_code.toLowerCase());
  }
  return (item.kind === "GROUP" ? "/office/chat/groups/" : "/office/chat/dm/") + item.id;
}
function shortType(item: Conversation) {
  return item.kind === "DM" ? "Private chat" : item.kind === "DEPARTMENT" ? "Department" : "Group";
}
function recentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleDateString("en-IN", {day:"numeric",month:"short",timeZone:"Asia/Kolkata"});
}

function EmptyIllustration() {
  return <svg className={styles.illustration} viewBox="0 0 280 218" aria-hidden="true" focusable="false">
    <rect x="62" y="22" width="174" height="162" rx="27" fill="#91c9f4"
      transform="rotate(-12 149 103)"/>
    <path d="M53 67C53 49 68 36 86 36H173C192 36 207 49 207 67V128C207 146 191 159 174 159H114L88 181V159H86C67 159 53 145 53 128Z"
      fill="#e9f3ff" stroke="#101a2a" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M91 83H172M91 109H151" fill="none" stroke="#557fa6" strokeWidth="9" strokeLinecap="round"/>
    <circle cx="208" cy="153" r="35" fill="#163b76" stroke="#1d2027" strokeWidth="5"/>
    <path d="M194 153H221M207.5 139V167" stroke="#beddfd" strokeWidth="7" strokeLinecap="round"/>
    <path d="M33 194H247" stroke="#8fc7f3" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}

export function OfficeConnectMobileHome({
  conversations, loading, error, liveRevision, onRefresh,
}: {
  conversations: Conversation[];
  loading: boolean;
  error: string;
  liveRevision: number;
  onRefresh: () => void;
}) {
  const {permissions}=useOfficeWorkspace();
  const showIT=permissions.includes("it.service.manage")||permissions.includes("it.service.read");
  const showSupport=permissions.includes("support.case.read")||permissions.includes("support.case.manage");
  const [workspaceMode,setWorkspaceMode]=useState<"chats"|RoleInboxKind>("chats");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [screen, setScreen] = useState<"home" | "chats">("home");
  const [moreOpen, setMoreOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<UnreadSnapshot | null>(null);
  const [unreadState, setUnreadState] = useState<UnreadState>("loading");
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/api/office-chat/unread", {
      credentials:"same-origin", cache:"no-store", signal:controller.signal,
    }).then(async response => {
      if (response.status === 401 || response.status === 403) {
        if (active) {setSnapshot(null); setUnreadState("restricted");}
        return;
      }
      if (!response.ok) throw new Error("Unread source unavailable");
      const result = await response.json() as Partial<UnreadSnapshot>;
      if (!Array.isArray(result.conversations) ||
          typeof result.unread_messages !== "number" ||
          typeof result.unread_conversations !== "number") {
        throw new Error("Unread source incomplete");
      }
      if (active) {
        setSnapshot({
          unread_messages: Number(result.unread_messages) || 0,
          unread_conversations: Number(result.unread_conversations) || 0,
          conversations: result.conversations,
        });
        setUnreadState("ready");
      }
    }).catch(() => {if (active) {setSnapshot(null);setUnreadState("unavailable");}});
    return () => {active=false;controller.abort();};
  }, [liveRevision, retryCount]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const unreadByConversation = useMemo(() => new Map<string, number>(
    (snapshot?.conversations ?? []).map(row => [
      row.conversation_id, Math.max(0, Number(row.unread) || 0),
    ] as const)), [snapshot]);
  const visible = useMemo(() => conversations.filter(item =>
    !unreadOnly || (unreadByConversation.get(item.id) ?? 0) > 0
  ), [conversations, unreadOnly, unreadByConversation]);
  const canShowRows = !loading && !error && (!unreadOnly || unreadState === "ready");
  const isEmpty = canShowRows && visible.length === 0;
  const hiddenUnread = unreadOnly && (snapshot?.unread_messages ?? 0) > 0 && isEmpty;

  const refresh = () => {
    setUnreadState("loading");
    setRetryCount(value => value + 1);
    onRefresh();
  };
  const choose = (next: "home" | "chats") => {
    setScreen(next);
    setUnreadOnly(next === "chats");
    setMoreOpen(false);
  };

  return <div className={styles.home} data-connect-mobile-home>
    <header className={styles.topbar}>
      <button className={styles.menuButton} type="button" aria-label="Open KRAVIA Office navigation"
        onClick={() => window.dispatchEvent(new Event("kravia-office-open-navigation"))}>
        <Menu size={25} aria-hidden="true"/>
      </button>
      <Link href="/office/chat/search" className={styles.searchLink}
        aria-label="Search in private conversations">
        <Search size={18} aria-hidden="true"/>
        <span>Search in chat</span>
      </Link>
      <Link href="/office/my-role" className={styles.brandAvatar} aria-label="My KRAVIA profile">
        <Image src="/brand/kravia-logo.png" width={36} height={36} alt="" />
      </Link>
    </header>

    <div className={styles.filterbar}>
      <h1>My Chats</h1>
      <label className={styles.unreadFilter}>
        <span>Unread</span>
        <input type="checkbox" role="switch" aria-label="Show unread conversations only"
          checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)}/>
        <span className={styles.track} aria-hidden="true"><span className={styles.thumb}/></span>
      </label>
      <Link href="/office/chat/saved" className={styles.bookmark}
        aria-label="Saved messages"><Bookmark size={20} aria-hidden="true"/></Link>
    </div>

    {showIT||showSupport?<nav className={styles.roleTabs} aria-label="Available Connect workspaces">
      <button type="button" data-active={workspaceMode==="chats"}
        aria-pressed={workspaceMode==="chats"} onClick={()=>setWorkspaceMode("chats")}>Chats</button>
      {showIT?<button type="button" data-active={workspaceMode==="it"}
        aria-pressed={workspaceMode==="it"} onClick={()=>setWorkspaceMode("it")}>IT tickets</button>:null}
      {showSupport?<button type="button" data-active={workspaceMode==="support"}
        aria-pressed={workspaceMode==="support"} onClick={()=>setWorkspaceMode("support")}>Support</button>:null}
    </nav>:null}

    <section className={styles.inbox} aria-label="Connect messages" aria-live="polite"
      aria-busy={workspaceMode==="chats"&&(loading||(unreadOnly&&unreadState==="loading"))}>
      {workspaceMode==="chats"?<>
      {loading ? <p className={styles.loadState} role="status">Loading your conversations…</p> : null}
      {!loading && error ? <div className={styles.failState} role="alert">
        <strong>Conversations unavailable</strong><p>{error}</p>
        <button type="button" onClick={refresh}><RefreshCw size={16}/>Retry</button>
      </div> : null}
      {!loading && !error && unreadOnly && unreadState === "loading" ?
        <p className={styles.loadState} role="status">Checking unread messages…</p> : null}
      {!loading && !error && unreadOnly && (unreadState === "restricted" || unreadState === "unavailable") ?
        <div className={styles.failState} role="status">
          <strong>Unread status unavailable</strong>
          <p>{unreadState === "restricted" ? "Your current session cannot read unread-message state." :
            "The unread-message source could not be reached. No zero count is assumed."}</p>
          <button type="button" onClick={refresh}><RefreshCw size={16}/>Retry</button>
        </div> : null}
      {isEmpty ? <div className={styles.emptyState}>
        <EmptyIllustration/>
        <h2>{hiddenUnread ? "Some unread chats are unavailable" : unreadOnly ? "No unread messages" : "No conversations yet"}</h2>
        {hiddenUnread ? <button type="button" onClick={refresh}>Refresh unread chats</button> : !unreadOnly ? <Link href="/office/chat/directory">Start a conversation <ArrowRight size={16}/></Link> : null}
      </div> : null}
      {canShowRows && visible.length > 0 ? <nav className={styles.conversationList}
        aria-label={unreadOnly ? "Unread conversations" : "All conversations"}>
        {visible.map(item => {
          const unread = unreadByConversation.get(item.id) ?? 0;
          return <Link key={item.id} href={conversationUrl(item)} className={styles.conversation}>
            <span className={styles.avatar} aria-hidden="true">
              {item.title.trim().slice(0,1).toUpperCase() || "K"}
            </span>
            <span className={styles.conversationText}>
              <strong>{item.title}</strong>
              <small>{shortType(item)} · {recentTime(item.updated_at)}</small>
            </span>
            {unread > 0 ? <span className={styles.unreadCount}
              aria-label={unread + " unread messages"}>{unread > 99 ? "99+" : unread}</span>
              : <ChevronRight size={17} className={styles.chevron} aria-hidden="true"/>}
          </Link>;
        })}
      </nav> : null}
      </>:<OfficeConnectRoleInbox kind={workspaceMode}/>}
    </section>

    <div className={styles.bottomControls}>
      {moreOpen ? <div className={styles.toolsMenu} role="dialog" aria-label="More Connect tools">
        <div className={styles.moreTitle}><strong>Connect tools</strong>
          <button type="button" aria-label="Close tools" onClick={() => setMoreOpen(false)}><X size={18}/></button>
        </div>
        <Link href="/office/notifications"><Bell size={17}/>Office notifications</Link>
        <Link href="/office/chat/mentions"><MessageCircle size={17}/>My mentions</Link>
        <Link href="/office/chat/saved"><Bookmark size={17}/>Saved messages</Link>
        <Link href="/office/chat/groups/new"><UsersRound size={17}/>New group</Link>
        <Link href="/office/chat/settings"><Settings2 size={17}/>Preferences</Link>
        <Link href="/office/chat/support"><UsersRound size={17}/>Support workspace</Link>
        <button type="button" onClick={() => {setMoreOpen(false);refresh();}}>
          <RefreshCw size={17}/>Refresh inbox</button>
      </div> : null}
      <nav className={styles.bottomPill} aria-label="Connect mobile navigation">
        <button type="button" aria-label="All chats" title="All chats" aria-current={screen === "home" ? "page" : undefined}
          data-active={screen === "home"} onClick={() => choose("home")}>
          <House size={23} aria-hidden="true"/>
        </button>
        <button type="button" aria-label="Unread chats" title="Unread chats" aria-current={screen === "chats" ? "page" : undefined}
          data-active={screen === "chats"} onClick={() => choose("chats")}>
          <MessageCircle size={23} aria-hidden="true"/>
        </button>
        <Link href="/office/chat/groups/new" aria-label="New group" title="New group">
          <UsersRound size={23} aria-hidden="true"/>
        </Link>
        <button type="button" aria-label="More Connect tools" aria-expanded={moreOpen}
          onClick={() => setMoreOpen(value => !value)}>
          <MoreHorizontal size={24} aria-hidden="true"/>
        </button>
      </nav>
      <Link href="/office/chat/directory" className={styles.newMessage}
        aria-label="Start a new conversation"><Plus size={29} aria-hidden="true"/></Link>
    </div>
  </div>;
}
