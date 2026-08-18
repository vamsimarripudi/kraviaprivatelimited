import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { CopyLinkButton } from "@/components/premium-interactions";
import { relatedContent } from "@/lib/content/relationships";
import type { PublicContentRecord } from "@/lib/content/types";

function typeLabel(type: PublicContentRecord["type"]) { return type.replaceAll("_", " "); }
function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(value)) : null; }
function paragraphs(body: unknown) {
  if (typeof body === "string") return [body];
  if (Array.isArray(body)) return body.flatMap((block) => typeof block === "string" ? [block] : block && typeof block === "object" && "text" in block && typeof block.text === "string" ? [block.text] : []);
  return [] as string[];
}

export function NewsroomLanding({ articles }: { articles: readonly PublicContentRecord[] }) {
  const [featured, ...latest] = articles;
  return <section className="newsroom-shell shell">
    {featured ? <article className="newsroom-feature"><p className="eyebrow">FEATURED · {typeLabel(featured.type)}</p><h2>{featured.title}</h2><p>{featured.summary}</p><Link href={`/newsroom/${featured.slug}`} className="text-link">Read the update <ArrowUpRight /></Link></article> : <div className="newsroom-empty"><FileText /><div><p className="eyebrow">OFFICIAL KRAVIA NEWSROOM</p><h2>Updates will appear here when they are ready.</h2><p>Kravia publishes company, product, engineering, research and press material only after it has been reviewed and approved.</p></div></div>}
    {latest.length > 0 && <div className="newsroom-list" aria-label="Latest updates">{latest.map((article) => <article key={article.id}><p className="eyebrow">{typeLabel(article.type)} · {dateLabel(article.publishedAt)}</p><h2><Link href={`/newsroom/${article.slug}`}>{article.title}</Link></h2><p>{article.summary}</p><Link href={`/newsroom/${article.slug}`} aria-label={`Read ${article.title}`}><ArrowUpRight /></Link></article>)}</div>}
  </section>;
}

export function NewsArticle({ article, allArticles }: { article: PublicContentRecord; allArticles: readonly PublicContentRecord[] }) {
  const related = relatedContent(article, allArticles);
  return <article className="article-shell shell">
    <header className="article-header"><p className="eyebrow">{typeLabel(article.type)} · {dateLabel(article.publishedAt)}</p><h1>{article.title}</h1>{article.summary && <p className="article-summary">{article.summary}</p>}<div className="article-meta"><span>By {article.authorName || "KRAVIA PRIVATE LIMITED"}</span>{article.updatedAt && <span>Updated {dateLabel(article.updatedAt)}</span>}<CopyLinkButton label="Copy link" /></div></header>
    <div className="article-reading">{paragraphs(article.body).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {related.length > 0 && <aside className="related-content"><p className="eyebrow">RELATED CONTENT</p><div>{related.map((item) => <Link key={item.id} href={`/newsroom/${item.slug}`}><span>{typeLabel(item.type)}</span><strong>{item.title}</strong><ArrowUpRight /></Link>)}</div></aside>}
  </article>;
}

export function MediaKitContent() {
  return <section className="media-kit shell"><div><p className="eyebrow">PRESS & MEDIA</p><h2>Official Kravia identity, clearly shared.</h2><p>Use the company name <strong>KRAVIA PRIVATE LIMITED</strong> in formal contexts and <strong>Kravia</strong> for approved brand references. The approved Kravia logo remains the only logo authorised for editorial use.</p></div><div className="media-kit-grid"><article><p className="eyebrow">COMPANY BOILERPLATE</p><p>Kravia Private Limited is an Indian technology company building software products, intelligent systems and digital infrastructure for organisations that need simpler, safer and more connected ways to work.</p></article><article><p className="eyebrow">BRAND USE</p><p>Do not redraw, alter or recreate the Kravia mark. Do not imply endorsement, partnership or certification without written approval.</p></article><article><p className="eyebrow">PRESS MATERIAL</p><p>Approved press releases and public company statements appear in the Newsroom when available. There are no public media releases configured at this time.</p></article></div></section>;
}
