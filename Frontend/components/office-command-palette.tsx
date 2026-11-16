"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Command, LoaderCircle, Search, X } from "lucide-react";
import type { OfficeNavigationCommand } from "@/lib/office/workspace-capabilities";
import styles from "./office-command-palette.module.css";

type SearchResult = {
  id: string;
  kind: string;
  label: string;
  meta: string;
  href: string;
};

export function OfficeCommandPalette({ commands, hideTrigger = false }: { commands: OfficeNavigationCommand[]; hideTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteFor,setRemoteFor]=useState("");
  const [failedFor,setFailedFor]=useState("");
  const [searchRevision,setSearchRevision]=useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim();
  // Only display record results from modules visible in the selected client
  // workspace. Backend API authorization remains the real data boundary.
  const visibleRemote = normalizedQuery.length >= 2 && remoteFor === normalizedQuery
    ? remote.filter(result=>{
      const pathname=result.href.split(/[?#]/,1)[0];
      return commands.some(command=>pathname===command.href||
        pathname.startsWith(command.href+"/"));
    })
    : [];
  const searchFailed = normalizedQuery.length >= 2 && failedFor === normalizedQuery;
  const waitingForRemote = normalizedQuery.length >= 2 && remoteFor !== normalizedQuery && !searchFailed;

  useEffect(() => {
    const openFromOverflow = () => setOpen(true);
    window.addEventListener("kravia-office-open-search", openFromOverflow);
    return () => window.removeEventListener("kravia-office-open-search", openFromOverflow);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "Escape") {
        setOpen(false);
        setQuery("");setRemote([]);setRemoteFor("");setFailedFor("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger = triggerRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);

    const onDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const selector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",");
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(selector) ?? [],
      );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onDialogKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onDialogKeyDown);
      document.body.style.overflow = originalOverflow;
      window.requestAnimationFrame(() => (previouslyFocused ?? trigger)?.focus());
    };
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/office-search?q=${encodeURIComponent(normalized)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Search unavailable");
        if(!controller.signal.aborted){setRemote(Array.isArray(body.results) ? body.results : []);setRemoteFor(normalized);setFailedFor("");}
      } catch {
        if(!controller.signal.aborted){setRemote([]);setRemoteFor(normalized);setFailedFor(normalized);}
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, searchRevision]);

  const local = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands.slice(0, 12);
    return commands.filter((command) => `${command.label} ${command.group} ${command.keywords}`.toLowerCase().includes(normalized)).slice(0, 12);
  }, [commands, query]);

  function updateQuery(next: string) {
    setQuery(next);
    setFailedFor("");
    if (next.trim().length < 2) {
      setRemoteFor("");
      setRemote([]);
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setQuery("");
    setRemote([]);
    setRemoteFor("");
    setFailedFor("");
    setLoading(false);
  }

  return <>
    {!hideTrigger ? <button ref={triggerRef} type="button" className={styles.trigger} data-office-global-search onClick={() => setOpen(true)} aria-label="Open KRAVIA Office search and command palette" aria-haspopup="dialog" aria-expanded={open} aria-controls="office-command-palette">
      <Search aria-hidden="true" /><span>Search</span><kbd><Command aria-hidden="true" />K</kbd>
    </button> : null}
    {open ? <div className={styles.backdrop} data-office-search-overlay role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} id="office-command-palette" className={styles.dialog} data-office-search-dialog role="dialog" aria-modal="true" aria-label="KRAVIA Office command palette">
        <div className={styles.inputRow} data-office-search-input-row>
          <Search aria-hidden="true" />
          <input ref={inputRef} type="search" autoComplete="off" spellCheck={false} data-office-search-input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search modules and records…" aria-label="Search KRAVIA Office" />
          {loading && normalizedQuery.length >= 2 ? <LoaderCircle className={styles.spin} aria-label="Searching" /> : null}
          <button type="button" onClick={close} aria-label="Close command palette"><X aria-hidden="true" /></button>
        </div>
        <div className={styles.results} aria-live="polite" aria-busy={loading}>
          {local.length ? <div className={styles.group}><p>Available modules</p>{local.map((command) => <Link href={command.href} key={command.id} onClick={close}><span><b>{command.label}</b><small>{command.group}</small></span><ArrowUpRight aria-hidden="true" /></Link>)}</div> : null}
          {visibleRemote.length ? <div className={styles.group}><p>Canonical records</p>{visibleRemote.map((result) => <Link href={result.href} key={result.id} onClick={close}><span><b>{result.label}</b><small>{result.kind} · {result.meta}</small></span><ArrowUpRight aria-hidden="true" /></Link>)}</div> : null}
          {searchFailed ? <div className={styles.searchError} role="status"><span>Record search is unavailable. You can still open your modules.</span><button type="button" onClick={()=>{setRemoteFor("");setFailedFor("");setSearchRevision(v=>v+1);}}>Retry</button></div> : null}
          {!local.length && !visibleRemote.length && !searchFailed && !waitingForRemote && !loading ? <div className={styles.empty}><Search aria-hidden="true" /><b>No visible result</b><span>Search only returns records and modules within your current Office authority.</span></div> : null}
        </div>
        <footer><span>Navigation is capability-filtered. Every record read and mutation remains server-authorized.</span><kbd>ESC</kbd></footer>
      </section>
    </div> : null}
  </>;
}
