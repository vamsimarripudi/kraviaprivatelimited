"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardCheck, MessageSquareText, RefreshCw, Search, Send, ShieldCheck } from "lucide-react";
import styles from "./office-connect.module.css";

type Conversation = { id: string; kind: string; title: string; updated_at: string };
type Message = { id: string; sender_user_id: string; sender_name: string; body: string; created_at: string; edited_at?: string | null };
type ListResponse = { actor_user_id: string; conversations: Conversation[] };
type MessageResponse = { actor_user_id: string; messages: Message[] };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const result = await response.json().catch(() => ({})) as T & { detail?: string };
  if (!response.ok) throw new Error(result.detail || (response.status === 403 ? "Access is restricted" : "The requested operation failed"));
  return result;
}

export function OfficeConnect({ initialConversationId }: { initialConversationId?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [actor, setActor] = useState("");
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageError, setMessageError] = useState("");
  const [messageLoading, setMessageLoading] = useState(!!initialConversationId);
  const [reloadCount, setReloadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const nonce = useRef<string | null>(null);
  const activeId = initialConversationId;
  const selected = conversations.find(row => row.id === activeId);

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
    if (!activeId) return;
    let live = true;
    const load = async () => {
      try {
        const response = await json<MessageResponse>("/api/office-chat/conversations/" + encodeURIComponent(activeId) + "/messages");
        if (!live) return;
        setMessages(response.messages);
        setActor(response.actor_user_id);
        setMessageError("");
      } catch (error) {
        if (live) { setMessages([]); setMessageError(error instanceof Error ? error.message : "Unable to load messages"); }
      } finally {
        if (live) setMessageLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { live = false; window.clearInterval(interval); };
  }, [activeId, reloadCount]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || submitting) return;
    setSubmitting(true);
    setSendStatus("");
    nonce.current ??= window.crypto.randomUUID();
    try {
      await json<{ message_id: string }>("/api/office-chat/conversations/" + encodeURIComponent(activeId) + "/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), client_nonce: nonce.current }),
      });
      nonce.current = null;
      setDraft("");
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
        <h1>{activeId ? selected?.title ?? "Private conversation" : "Communications"}</h1>
        <p>Employee-only conversations. Formal approvals, access grants and payments remain in their governed systems.</p></div>
      <div className={styles.headerActions}>
        <Link href="/office/chat/directory"><Search size={17} aria-hidden="true"/>Find employee</Link>
        <button type="button" onClick={() => setReloadCount(v => v + 1)} aria-label="Refresh Connect" title="Refresh"><RefreshCw size={17}/></button>
      </div>
    </header>
    <div className={styles.grid}>
      <aside className={styles.sidebar} aria-label="Conversations">
        <div className={styles.sideHeading}><h2>My conversations</h2><span>{conversations.length}</span></div>
        {listLoading ? <div className={styles.skeleton} role="status">Loading authorized conversations…</div> : null}
        {listError ? <div className={styles.error} role="alert"><p>{listError}</p><button type="button" onClick={() => setReloadCount(n => n + 1)}>Retry</button></div> : null}
        {!listLoading && !listError && !conversations.length
          ? <div className={styles.empty}><MessageSquareText size={22} aria-hidden="true"/><p>No conversations yet.</p><Link href="/office/chat/directory">Start a private conversation</Link></div>
          : null}
        <nav className={styles.conversations} aria-label="Conversation list">
          {conversations.map(item => <Link key={item.id} href={"/office/chat/dm/" + item.id}
            aria-current={item.id === activeId ? "page" : undefined}>
            <span className={styles.avatar} aria-hidden="true">{item.title.trim().charAt(0).toUpperCase() || "K"}</span>
            <span className={styles.conversationName}><strong>{item.title}</strong><small>{item.kind === "DM" ? "Private · members only" : item.kind}</small></span>
            <ArrowRight size={15} aria-hidden="true"/></Link>)}
        </nav>
      </aside>
      <section className={styles.body} aria-label={activeId ? "Private messages" : "Connect workspace"}>
        {!activeId ? <>
          <div className={styles.welcome}><ShieldCheck size={30} aria-hidden="true"/><h2>Private by membership</h2>
            <p>Start with an eligible employee. Conversation content is reauthorized for every read and message submission.</p>
            <Link href="/office/chat/directory">Employee directory <ArrowRight size={16} aria-hidden="true"/></Link></div>
          <nav className={styles.quick} aria-label="Related Office workflows">
            <Link href="/office/chat/support"><ShieldCheck size={19}/>IT & Customer Support <ArrowRight size={16}/></Link>
            <Link href="/office/chat/approvals"><ClipboardCheck size={19}/>Formal approvals <ArrowRight size={16}/></Link>
            <Link href="/office/chat/activity"><MessageSquareText size={19}/>My notifications <ArrowRight size={16}/></Link>
          </nav>
        </> : <>
          <div className={styles.threadHeader}><Link href="/office/chat" className={styles.back}><ArrowLeft size={17}/>All conversations</Link><span>Verified membership · Internal</span></div>
          <div className={styles.timeline} role="log" aria-label="Message history" aria-live="polite">
            {messageLoading ? <div className={styles.skeleton}>Opening private history…</div> : null}
            {messageError ? <div className={styles.error} role="alert"><p>{messageError}</p>
              <button type="button" onClick={() => setReloadCount(v=>v+1)}>Retry</button></div> : null}
            {!messageLoading && !messageError && !messages.length ? <div className={styles.empty}>No messages yet. Start the conversation below.</div> : null}
            {messages.map(message => <article key={message.id} className={styles.message} data-own={message.sender_user_id === actor}>
              <strong>{message.sender_user_id === actor ? "You" : message.sender_name}</strong>
              <p>{message.body}</p>
              <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
            </article>)}
          </div>
          <form className={styles.composer} onSubmit={send}>
            <label htmlFor="office-chat-message">Message</label>
            <div><textarea id="office-chat-message" value={draft} maxLength={4000} rows={2}
              placeholder="Write a message for verified participants…" disabled={submitting || !!messageError}
              onChange={event => { nonce.current = null; setDraft(event.target.value); setSendStatus(""); }}
              onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.form?.requestSubmit(); }}/>
              <button type="submit" disabled={!draft.trim() || submitting || !!messageError}><Send size={16}/> {submitting ? "Sending…" : "Send"}</button>
            </div>
            {sendStatus ? <p role="status" className={styles.sendStatus}>{sendStatus}</p> : null}
            <small>A stored message is not a formal approval or instruction to execute an action.</small>
          </form>
        </>}
      </section>
    </div>
  </section>;
}
