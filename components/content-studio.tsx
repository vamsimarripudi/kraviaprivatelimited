"use client";

import { FormEvent, useState } from "react";
import { FilePenLine, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { createContent, requestContentReview } from "@/app/corporate/content/actions";

const types = ["NEWS", "PRESS_RELEASE", "ENGINEERING_ARTICLE", "PRODUCT", "TRUST_DOCUMENT", "POLICY", "CORPORATE_DISCLOSURE", "REPORT", "CAREER"] as const;

export function ContentStudio() {
  const [pending, setPending] = useState(false); const [status, setStatus] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setStatus(undefined);
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const summary = String(form.get("summary") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    try {
      const result = await createContent({ type: String(form.get("type")) as typeof types[number], title, slug, summary: summary || null, body: [{ type: "paragraph", text: body }], category: String(form.get("category") ?? "").trim() || null, authorName: String(form.get("author") ?? "").trim() || null, seo: { title: String(form.get("seoTitle") ?? title).trim(), description: String(form.get("seoDescription") ?? summary).trim(), canonicalPath: `/${String(form.get("path") ?? "newsroom").replace(/^\/+|\/+$/g, "")}/${slug}` } });
      if (form.get("submitForReview") === "on") await requestContentReview({ id: result.id });
      event.currentTarget.reset(); setStatus(form.get("submitForReview") === "on" ? "Draft created and sent into the governed review queue." : "Private draft created. It is not visible on the public website.");
    } catch { setStatus("This content could not be saved. Check the required fields and your assigned role."); }
    finally { setPending(false); }
  }
  return <section className="content-studio"><header><div><p className="eyebrow">GOVERNED CONTENT</p><h2>Create a public-site record</h2><p>Every new record starts private. Publication requires the existing review and approval workflow; the website then reads only approved public content.</p></div><ShieldCheck aria-hidden="true" /></header><form onSubmit={submit} className="content-studio-form"><label>Content type<select name="type" defaultValue="NEWS">{types.map((type) => <option key={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label>Title<input name="title" required maxLength={180} /></label><label>URL slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="company-update" /></label><label>Route group<select name="path" defaultValue="newsroom"><option value="newsroom">Newsroom</option><option value="trust">Trust</option><option value="disclosures">Disclosures</option><option value="products">Products</option></select></label><label className="content-wide">Summary<textarea name="summary" required maxLength={500} rows={3} /></label><label className="content-wide">Body<textarea name="body" required rows={8} /></label><label>Category<input name="category" maxLength={80} placeholder="Company" /></label><label>Public author<input name="author" maxLength={160} placeholder="KRAVIA PRIVATE LIMITED" /></label><label>SEO title<input name="seoTitle" required maxLength={180} /></label><label>SEO description<input name="seoDescription" required maxLength={200} /></label><label className="content-check"><input type="checkbox" name="submitForReview" /> Send this private draft for review</label>{status ? <p className="content-status" role="status">{status}</p> : null}<button className="button button-dark" disabled={pending}>{pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <FilePenLine aria-hidden="true" />}{pending ? "Saving…" : "Create governed draft"}</button></form><p className="content-studio-note"><Send aria-hidden="true" /> A draft does not become public just because it was uploaded. An authorised publisher releases only approved content.</p></section>;
}
