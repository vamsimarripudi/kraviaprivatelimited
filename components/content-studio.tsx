"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, FilePenLine, LoaderCircle, Route, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { contentSeoChecks, createContent, requestContentReview } from "@/app/corporate/content/actions";
import { contentPath } from "@/lib/content/seo";
import type { PublicContentType } from "@/lib/content/types";

const types = ["COMPANY", "PRODUCT", "MILESTONE", "PRINCIPLE", "LEADERSHIP", "TECHNOLOGY", "RESEARCH", "NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "TRUST_DOCUMENT", "POLICY", "CORPORATE_DISCLOSURE", "REPORT", "CAREER", "PARTNER", "FAQ"] as const;

type SeoIssue = { code: string; severity: "error" | "warning"; message: string };
type QualityReport = { issues: SeoIssue[]; highRiskClaims: string[] };

type DraftInput = {
  type: PublicContentType;
  title: string;
  slug: string;
  summary: string | null;
  body: { type: "paragraph"; text: string }[];
  category: string | null;
  authorName: string | null;
  seo: { title: string; description: string; canonicalPath: string; ogImage: string | null };
};

function structuredParagraphs(value: string) {
  return value.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ type: "paragraph" as const, text }));
}

function toDraftInput(form: FormData): DraftInput {
  const title = String(form.get("title") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim();
  const summary = String(form.get("summary") ?? "").trim();
  const type = String(form.get("type") ?? "NEWS") as PublicContentType;
  return {
    type,
    title,
    slug,
    summary: summary || null,
    body: structuredParagraphs(String(form.get("body") ?? "").trim()),
    category: String(form.get("category") ?? "").trim() || null,
    authorName: String(form.get("author") ?? "").trim() || null,
    seo: {
      title: String(form.get("seoTitle") ?? "").trim() || title,
      description: String(form.get("seoDescription") ?? "").trim() || summary,
      canonicalPath: contentPath({ type, slug: slug || "your-slug" }),
      ogImage: String(form.get("ogImage") ?? "").trim() || null,
    },
  };
}

export function ContentStudio() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();
  const [quality, setQuality] = useState<QualityReport>();
  const [preview, setPreview] = useState({ type: "NEWS" as PublicContentType, slug: "your-slug" });
  const canonicalPath = useMemo(() => contentPath(preview), [preview]);

  function updatePreview(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    setPreview({
      type: String(form.get("type") ?? "NEWS") as PublicContentType,
      slug: String(form.get("slug") ?? "").trim() || "your-slug",
    });
  }

  async function checkQuality(formElement: HTMLFormElement) {
    const report = await contentSeoChecks(toDraftInput(new FormData(formElement)));
    setQuality(report);
    return report;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setStatus(undefined);
    try {
      const draft = toDraftInput(new FormData(formElement));
      const report = await checkQuality(formElement);
      const hasBlockingIssue = report.issues.some((issue) => issue.severity === "error");
      const sendForReview = new FormData(formElement).get("submitForReview") === "on";
      if (sendForReview && hasBlockingIssue) {
        setStatus("Resolve the highlighted quality issues before sending this record for review. You can still save it as a private draft.");
        return;
      }
      const result = await createContent(draft);
      if (sendForReview) await requestContentReview({ id: result.id });
      formElement.reset();
      setPreview({ type: "NEWS", slug: "your-slug" });
      setStatus(sendForReview ? "Draft created and sent into the governed review queue." : "Private draft created. It is not visible on the public website.");
    } catch {
      setStatus("This content could not be saved. Check the required fields and your assigned role.");
    } finally {
      setPending(false);
    }
  }

  async function runQualityCheck(event: FormEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    setPending(true);
    setStatus(undefined);
    try {
      const report = await checkQuality(form);
      setStatus(report.issues.length || report.highRiskClaims.length ? "Quality review completed. Address any highlighted items before publishing." : "Quality review passed. This record is ready for its required reviewers.");
    } catch {
      setStatus("Quality review could not run. Complete the required fields and try again.");
    } finally {
      setPending(false);
    }
  }

  return <section className="content-studio"><header><div><p className="eyebrow">GOVERNED CONTENT</p><h2>Create a public-site record</h2><p>Every new record starts private. Publication requires the existing review and approval workflow; the website then reads only approved public content.</p></div><ShieldCheck aria-hidden="true" /></header><form onSubmit={submit} onInput={updatePreview} className="content-studio-form"><label>Content type<select name="type" defaultValue="NEWS">{types.map((type) => <option key={type}>{type.replaceAll("_", " ")}</option>)}</select></label><div className="content-route" aria-live="polite"><Route aria-hidden="true" /><span>Public route</span><code>{canonicalPath}</code><small>Private until approved and published</small></div><label>Title<input name="title" required maxLength={180} /></label><label>URL slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="company-update" /></label><label className="content-wide">Summary<textarea name="summary" required maxLength={500} rows={3} /></label><label className="content-wide">Body<textarea name="body" required rows={8} /></label><label>Category<input name="category" maxLength={80} placeholder="Company" /></label><label>Public author<input name="author" maxLength={160} placeholder="KRAVIA PRIVATE LIMITED" /></label><label>SEO title<input name="seoTitle" maxLength={180} aria-describedby="seo-title-note" /><small id="seo-title-note">Uses the record title when left empty.</small></label><label>SEO description<input name="seoDescription" maxLength={200} aria-describedby="seo-description-note" /><small id="seo-description-note">Uses the summary when left empty.</small></label><label className="content-wide">Social-preview image path<input name="ogImage" inputMode="url" placeholder="/images/newsroom/company-update.jpg" /><small>Recommended for product, newsroom, engineering, research, and press records.</small></label><label className="content-check"><input type="checkbox" name="submitForReview" /> Send this private draft for review</label>{quality ? <div className="content-quality" role="status"><div><CheckCircle2 aria-hidden="true" /><strong>Publishing quality review</strong></div>{quality.issues.length ? <ul>{quality.issues.map((issue) => <li className={`is-${issue.severity}`} key={issue.code}>{issue.message}</li>)}</ul> : <p>No SEO issues were found in this draft.</p>}{quality.highRiskClaims.length ? <p className="content-claim-warning"><ShieldAlert aria-hidden="true" /> Review claim wording before approval: {quality.highRiskClaims.join(", ")}.</p> : null}</div> : null}{status ? <p className="content-status" role="status">{status}</p> : null}<div className="content-actions"><button type="button" className="button button-light" disabled={pending} onClick={runQualityCheck}>Check quality</button><button className="button button-dark" disabled={pending}>{pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <FilePenLine aria-hidden="true" />}{pending ? "Saving…" : "Create governed draft"}</button></div></form><p className="content-studio-note"><Send aria-hidden="true" /> A draft does not become public just because it was uploaded. An authorised publisher releases only approved content.</p></section>;
}
