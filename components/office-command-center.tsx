"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Command, Search, X } from "lucide-react";

const commands = [
  ["My work", "/office/dashboard", "Workspace"],
  ["Create request", "/office/requests?new=1", "Workflow"],
  ["Requests", "/office/requests", "Workflow"],
  ["Approvals", "/office/approvals", "Workflow"],
  ["Manager workspace", "/office/manager", "Leadership"],
  ["Access administration", "/office/access", "Administration"],
  ["People", "/office/people", "Company"],
  ["Products", "/office/products", "Company"],
  ["Documents", "/office/documents", "Records"],
  ["Contracts", "/office/contracts", "Records"],
  ["Finance", "/finance/dashboard", "Finance"],
  ["GST & tax", "/finance/gst", "Finance"],
  ["Payments", "/finance/payments", "Finance"],
  ["Audit trail", "/office/audit", "Assurance"],
] as const;

export function OfficeCommandCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(([label, href, group]) => `${label} ${href} ${group}`.toLowerCase().includes(needle));
  }, [query]);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return <>
    <div className="office-command-actions">
      <button className="office-command-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open command palette">
        <Search aria-hidden="true" /><span>Search Office</span><kbd>⌘ K</kbd>
      </button>
      <button className="office-icon-action" type="button" onClick={() => go("/office/approvals")} aria-label="Open approvals"><Bell aria-hidden="true" /></button>
    </div>

    {open ? <div className="office-command-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="office-command-dialog" role="dialog" aria-modal="true" aria-label="KRAVIA Office command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="office-command-search"><Command aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules, workflows and actions…" /><button type="button" onClick={() => setOpen(false)} aria-label="Close command palette"><X /></button></div>
        <div className="office-command-results">
          {filtered.map(([label, href, group]) => <button type="button" key={href} onClick={() => go(href)}><span><b>{label}</b><small>{group}</small></span><code>{href}</code></button>)}
          {!filtered.length ? <p>No matching Office action.</p> : null}
        </div>
      </section>
    </div> : null}
  </>;
}
