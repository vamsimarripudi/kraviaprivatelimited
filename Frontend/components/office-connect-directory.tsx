"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquareText, Search } from "lucide-react";
import styles from "./office-connect.module.css";

type Employee = { user_id: string; display_name: string; job_title?: string | null; primary_department?: string | null };
export function OfficeConnectDirectory() {
  const router = useRouter();
  const [people, setPeople] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/office-chat/directory?q=" + encodeURIComponent(submitted),
          { cache:"no-store",credentials:"same-origin" });
        const payload = await response.json().catch(() => ({})) as { employees?: Employee[]; detail?: string };
        if (!response.ok) throw new Error(payload.detail || "Directory unavailable");
        if (live) { setPeople(payload.employees ?? []); setError(""); }
      } catch (error) {
        if (live) setError(error instanceof Error ? error.message : "Directory unavailable");
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [submitted,attempt]);

  async function start(id: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/office-chat/conversations",
        { method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipient_user_id:id}) });
      const payload = await response.json().catch(() => ({})) as { conversation_id?:string;detail?:string };
      if (!response.ok || !payload.conversation_id) throw new Error(payload.detail || "Conversation not confirmed");
      router.push("/office/chat/dm/" + payload.conversation_id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Conversation not confirmed");
      setBusy("");
    }
  }

  return <section className={styles.directory}>
    <Link href="/office/chat" className={styles.back}><ArrowLeft size={17} aria-hidden="true"/>Connect</Link>
    <p className={styles.eyebrow}>KRAVIA CONNECT</p><h1>Employee directory</h1>
    <p>Only active Office identities are listed. Private HR records and personal contact details are not disclosed.</p>
    <form className={styles.searchForm} onSubmit={(event: FormEvent<HTMLFormElement>) => {event.preventDefault();setLoading(true);setSubmitted(query);setAttempt(v=>v+1);}}>
      <label htmlFor="office-chat-directory-search">Search employees</label>
      <div><input id="office-chat-directory-search" value={query} onChange={e=>setQuery(e.target.value)} maxLength={80}
          placeholder="Name"/><button type="submit"><Search size={17}/>Search</button></div>
    </form>
    {error ? <div role="alert" className={styles.error}><p>{error}</p>
      <button type="button" onClick={() => {setLoading(true);setAttempt(v=>v+1);}}>Retry</button></div> : null}
    {loading ? <p role="status">Loading permitted employees…</p> : null}
    {!loading && !error && !people.length ? <div className={styles.empty}>No eligible employees match this search.</div> : null}
    <div className={styles.people}>
      {people.map(person=><article key={person.user_id}>
        <span className={styles.avatar} aria-hidden="true">{person.display_name?.trim().charAt(0).toUpperCase() || "K"}</span>
        <div><strong>{person.display_name || "Employee"}</strong>
          <small>{[person.job_title,person.primary_department].filter(Boolean).join(" · ")}</small></div>
        <button disabled={!!busy} type="button" onClick={()=>void start(person.user_id)}>
          <MessageSquareText size={16}/> {busy===person.user_id?"Opening…":"Message"}</button>
      </article>)}
    </div>
  </section>;
}
