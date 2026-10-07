import Link from "next/link";
import { ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import { publicContentPath } from "@/lib/content/seo";
import type { PublicContentRecord } from "@/lib/content/types";
import { legalDocumentGroupLabels } from "@/lib/legal/groups";
import { legalDocumentGroup } from "@/lib/legal/published-policy-pack";
import { parseLegalDocumentBody } from "@/lib/legal/document-body";
import type { LegalDocumentGroup } from "@/lib/legal/types";
import styles from "./legal-trust-center.module.css";

const groupOrder: readonly LegalDocumentGroup[] = ["COMPANY_AND_TRUST", "PRIVACY_AND_DATA_RIGHTS", "AI_AND_ACCEPTABLE_USE", "COMMERCIAL_TERMS", "SECURITY_AND_REPORTING", "REGIONAL_RIGHTS"];

const knownGroups: Record<string, LegalDocumentGroup> = {
  "trust-charter": "COMPANY_AND_TRUST", privacy: "PRIVACY_AND_DATA_RIGHTS", "data-rights": "PRIVACY_AND_DATA_RIGHTS", "retention-deletion": "PRIVACY_AND_DATA_RIGHTS", cookies: "PRIVACY_AND_DATA_RIGHTS", "ai-policy": "AI_AND_ACCEPTABLE_USE", "acceptable-use": "AI_AND_ACCEPTABLE_USE", terms: "COMMERCIAL_TERMS", "billing-refunds": "COMMERCIAL_TERMS", security: "SECURITY_AND_REPORTING", "vulnerability-disclosure": "SECURITY_AND_REPORTING", "india-privacy": "REGIONAL_RIGHTS", "us-privacy": "REGIONAL_RIGHTS", "europe-uk-privacy": "REGIONAL_RIGHTS", "consumer-rights": "REGIONAL_RIGHTS",
};

function formatDate(value?: string | null) {
  if (!value) return "Approved public document";
  return `Published ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value))}`;
}

function effectiveDate(record: PublicContentRecord) {
  const document = parseLegalDocumentBody(record.body);
  if (document?.effectiveDate) return `Effective ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(document.effectiveDate))}`;
  return formatDate(record.publishedAt);
}

function groupFor(record: PublicContentRecord) {
  return legalDocumentGroup(record) ?? knownGroups[record.slug] ?? (record.type === "TRUST_DOCUMENT" ? "COMPANY_AND_TRUST" : "COMPANY_AND_TRUST");
}

export function LegalTrustCenter({ scope, records }: { scope: "legal" | "trust"; records: readonly PublicContentRecord[] }) {
  const documents = records.filter((record) => record.type === "POLICY" || record.type === "TRUST_DOCUMENT");
  const heading = scope === "legal" ? "Legal & Trust Center" : "Trust Center";
  const intro = scope === "legal"
    ? "Approved public policies, notices and trust information are collected here. Review drafts, internal records and customer agreements remain private."
    : "Find approved public trust information, privacy routes and responsible reporting channels without turning internal governance records into public claims.";
  return <section className={styles.center} aria-labelledby="legal-trust-title">
    <header className={styles.header}>
      <p className="eyebrow">KRAVIA PRIVATE LIMITED</p>
      <h1 id="legal-trust-title">{heading}</h1>
      <p>{intro}</p>
      <div className={styles.actions}><Link className="button button-dark" href="/privacy-request">Request help with your information <ArrowUpRight aria-hidden="true" /></Link><Link className="text-link" href="/support">Support &amp; case tracking <ArrowUpRight aria-hidden="true" /></Link></div>
    </header>

    <section className={styles.readingNote} aria-labelledby="reading-note-title"><ShieldCheck aria-hidden="true" /><div><p className="eyebrow">PUBLICATION CONTROL</p><h2 id="reading-note-title">A clear record of what is public.</h2><p>Documents appear only after their content, scope, approval and release conditions have been recorded. A target effective date or successful website build does not publish a draft.</p></div></section>

    <div className={styles.groups}>{groupOrder.map((group) => {
      const items = documents.filter((record) => groupFor(record) === group);
      const label = legalDocumentGroupLabels[group];
      return <section key={group} className={styles.group} aria-labelledby={`group-${group}`}><header><p className="eyebrow">{label.title}</p><h2 id={`group-${group}`}>{label.description}</h2></header>{items.length ? <ul>{items.map((record) => <li key={record.id}><Link href={publicContentPath(record)}><span><FileText aria-hidden="true" />{record.title}</span><ArrowUpRight aria-hidden="true" /></Link><small>{effectiveDate(record)}</small></li>)}</ul> : <p className={styles.empty}>No additional approved public documents are available in this group.</p>}</section>;
    })}</div>

    <section className={styles.help} aria-labelledby="help-title"><p className="eyebrow">WORKING ROUTES</p><h2 id="help-title">Need to make a request?</h2><div><Link href="/privacy-request"><strong>Privacy, accessibility or grievance request</strong><span>Submit a private request and receive a safe reference.</span><ArrowUpRight aria-hidden="true" /></Link><Link href="/trust/security-reporting"><strong>Security concern</strong><span>Use the restricted reporting route—never send passwords or secrets.</span><ArrowUpRight aria-hidden="true" /></Link><Link href="/support"><strong>Support &amp; case tracking</strong><span>Open or check a general support case with its private tracking code.</span><ArrowUpRight aria-hidden="true" /></Link></div></section>
  </section>;
}
