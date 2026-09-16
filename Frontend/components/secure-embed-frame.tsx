"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Maximize2, RefreshCw, ShieldCheck } from "lucide-react";

export function SecureEmbedFrame({ title, src, allowedHosts }: { title: string; src: string; allowedHosts: readonly string[] }) {
  const [revision, setRevision] = useState(0);
  const parsed = useMemo(() => {
    try {
      const url = new URL(src);
      if (url.protocol !== "https:") return null;
      if (!allowedHosts.includes(url.hostname)) return null;
      if (url.username || url.password) return null;
      return url;
    } catch {
      return null;
    }
  }, [allowedHosts, src]);

  if (!parsed) {
    return <section className="office-embed-blocked"><ShieldCheck /><div><b>Embed blocked by KRAVIA policy</b><p>The destination is not on this module&apos;s explicit HTTPS framing allowlist.</p></div></section>;
  }

  return <section className="office-embed-shell">
    <header><div><ShieldCheck /><span><b>{title}</b><small>{parsed.hostname}</small></span></div><div><button type="button" onClick={() => setRevision((value) => value + 1)} aria-label="Refresh embedded workspace"><RefreshCw /></button><a href={parsed.toString()} target="_blank" rel="noreferrer" aria-label="Open embedded workspace externally"><ExternalLink /></a><a href={parsed.toString()} target="_blank" rel="noreferrer" aria-label="Open full screen"><Maximize2 /></a></div></header>
    <iframe key={revision} src={parsed.toString()} title={title} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-forms allow-scripts allow-same-origin allow-popups" allow="clipboard-read; clipboard-write" />
  </section>;
}
