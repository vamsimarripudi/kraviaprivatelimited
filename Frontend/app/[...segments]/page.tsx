import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { GovernedContentCollection } from "@/components/governed-content-collection";
import { PublicContentArticle, NewsroomLanding, MediaKitContent } from "@/components/newsroom-content";
import { PageHero, Reveal } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { publicPages, siteUrl } from "@/lib/site";
import { PublicPageContent } from "@/components/public-page-content";
import { BreadcrumbJsonLd } from "@/components/structured-data";
import { articleJsonLd, contentMetadata } from "@/lib/content/seo";
import { publicContentForHub, publicHubContentTypes } from "@/lib/content/hubs";
import { getPublishedNewsroomContent, getPublishedContentByPublicPath, listPublishedContent, resolvePublishedRedirect } from "@/lib/content/repository";
import type { PublicContentRecord, PublicContentType } from "@/lib/content/types";

function titleFor(page: { eyebrow: string; title: string }) { return page.eyebrow.includes("/") ? page.eyebrow.replace(" / ", " · ") : page.eyebrow; }
function breadcrumbsFor(segments: string[]) { return [{ name: "Home", path: "/" }, ...segments.map((segment, index) => ({ name: segment.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()), path: `/${segments.slice(0, index + 1).join("/")}` }))]; }

export async function generateMetadata({ params }: { params: Promise<{ segments: string[] }> }): Promise<Metadata> {
  const { segments } = await params; const key = segments.join("/"); const page = publicPages[key];
  const content = await getPublishedContentByPublicPath(`/${key}`);
  // A published public record is the canonical source for its own path. The
  // version-controlled page is an intentional fallback until that happens.
  if (content) return contentMetadata(content);
  if (page) { const url = `${siteUrl}/${key}`; return { title: titleFor(page), description: page.intro, alternates: { canonical: `/${key}` }, openGraph: { title: `${titleFor(page)} | Kravia Private Limited`, description: page.intro, url, type: "website" } }; }
  return {};
}

export default async function PublicPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params; const key = segments.join("/"); const page = publicPages[key];
  const content = await getPublishedContentByPublicPath(`/${key}`);
  if (content) {
    const allContent = await listPublishedContent();
    const schema = articleJsonLd(content);
    return <><SiteNav /><BreadcrumbJsonLd items={breadcrumbsFor(segments)} />{schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}<main id="main-content"><PublicContentArticle article={content} allArticles={allContent} /></main><Footer /></>;
  }
  if (!page) { const redirect = await resolvePublishedRedirect(`/${key}`); if (redirect) permanentRedirect(redirect); notFound(); }
  const breadcrumbs = breadcrumbsFor(segments);
  const [newsroom, published] = await Promise.all([
    key === "newsroom" ? getPublishedNewsroomContent() : Promise.resolve([]),
    publicHubContentTypes[key] ? listPublishedContent() : Promise.resolve([]),
  ]);
  const hubRecords = publicContentForHub(key, published);
  const enhanced = key === "newsroom" ? <NewsroomLanding articles={newsroom} /> : key === "newsroom/media-kit" ? <MediaKitContent /> : <PublicPageContent slug={key} />;
  return <><SiteNav /><BreadcrumbJsonLd items={breadcrumbs} /><main id="main-content"><PageHero {...page} />{enhanced ?? <section className="content-grid shell">{page.sections.map((section, i) => <Reveal key={section.title} className="content-row"><span>0{i + 1}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></Reveal>)}</section>}{hubRecords.length ? <GovernedContentCollection intro="Only reviewed, approved, and publicly released records appear here. Drafts, evidence, and review notes remain private." records={hubRecords} /> : null}{key === "contact" && <section className="shell"><Link className="button button-dark" href="/privacy-request">Submit a secure request <ArrowUpRight /></Link></section>}</main><Footer /></>;
}