import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { publicContentPath } from "@/lib/content/seo";
import type { PublicContentRecord } from "@/lib/content/types";

function formatType(type: PublicContentRecord["type"]) {
  return type.replaceAll("_", " ");
}

function dateLabel(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value)) : null;
}

export function GovernedContentCollection({ heading = "Approved public records", intro, records }: { heading?: string; intro: string; records: readonly PublicContentRecord[] }) {
  if (!records.length) return null;
  return <section className="governed-content-collection shell" aria-labelledby="governed-content-title">
    <header><div><p className="eyebrow">GOVERNED CONTENT</p><h2 id="governed-content-title">{heading}</h2><p>{intro}</p></div><FileText aria-hidden="true" /></header>
    <div>{records.map((record) => <article key={record.id}><p className="eyebrow">{formatType(record.type)}{record.publishedAt ? ` · ${dateLabel(record.publishedAt)}` : ""}</p><h3><Link href={publicContentPath(record)}>{record.title}</Link></h3>{record.summary ? <p>{record.summary}</p> : null}<Link className="text-link" href={publicContentPath(record)}>Read record <ArrowUpRight aria-hidden="true" /></Link></article>)}</div>
  </section>;
}