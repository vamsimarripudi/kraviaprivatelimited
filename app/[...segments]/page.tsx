import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { NewsArticle, NewsroomLanding, MediaKitContent } from "@/components/newsroom-content";
import { PageHero, Reveal } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { publicPages, siteUrl } from "@/lib/site";
import { PublicPageContent } from "@/components/public-page-content";
import { BreadcrumbJsonLd } from "@/components/structured-data";
import { articleJsonLd, contentMetadata } from "@/lib/content/seo";
import { getPublishedNewsroomContent, getPublishedContentByPath, resolvePublishedRedirect } from "@/lib/content/repository";

function titleFor(page: { eyebrow: string; title: string }) { return page.eyebrow.includes("/") ? page.eyebrow.replace(" / ", " · ") : page.eyebrow; }
function breadcrumbsFor(segments: string[]) { return [{ name: "Home", path: "/" }, ...segments.map((segment, index) => ({ name: segment.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()), path: `/${segments.slice(0, index + 1).join("/")}` }))]; }

export async function generateMetadata({ params }: { params: Promise<{ segments: string[] }> }): Promise<Metadata> {
  const { segments } = await params; const key = segments.join("/"); const page = publicPages[key];
  if (page) { const url = `${siteUrl}/${key}`; return { title: titleFor(page), description: page.intro, alternates: { canonical: `/${key}` }, openGraph: { title: `${titleFor(page)} | Kravia Private Limited`, description: page.intro, url, type: "website" } }; }
  if (segments.length === 2 && segments[0] === "newsroom") { const article = await getPublishedContentByPath("NEWS", segments[1]) ?? await getPublishedContentByPath("PRESS_RELEASE", segments[1]) ?? await getPublishedContentByPath("ENGINEERING_ARTICLE", segments[1]) ?? await getPublishedContentByPath("RESEARCH", segments[1]); if (article) return contentMetadata(article); }
  return {};
}

export default async function PublicPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params; const key = segments.join("/"); const page = publicPages[key];
  if (!page && segments.length === 2 && segments[0] === "newsroom") {
    const article = await getPublishedContentByPath("NEWS", segments[1]) ?? await getPublishedContentByPath("PRESS_RELEASE", segments[1]) ?? await getPublishedContentByPath("ENGINEERING_ARTICLE", segments[1]) ?? await getPublishedContentByPath("RESEARCH", segments[1]);
    if (article) { const articles = await getPublishedNewsroomContent(); const schema = articleJsonLd(article); return <><SiteNav /><BreadcrumbJsonLd items={breadcrumbsFor(segments)} />{schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}<main id="main-content"><NewsArticle article={article} allArticles={articles} /></main><Footer /></>; }
  }
  if (!page) { const redirect = await resolvePublishedRedirect(`/${key}`); if (redirect) permanentRedirect(redirect); notFound(); }
  const breadcrumbs = breadcrumbsFor(segments);
  const enhanced = key === "newsroom" ? <NewsroomLanding articles={await getPublishedNewsroomContent()} /> : key === "newsroom/media-kit" ? <MediaKitContent /> : <PublicPageContent slug={key} />;
  return <><SiteNav /><BreadcrumbJsonLd items={breadcrumbs} /><main id="main-content"><PageHero {...page} />{enhanced ?? <section className="content-grid shell">{page.sections.map((section, i) => <Reveal key={section.title} className="content-row"><span>0{i + 1}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></Reveal>)}</section>}{key === "contact" && <section className="shell"><Link className="button button-dark" href="/privacy-request">Submit a secure request <ArrowUpRight /></Link></section>}</main><Footer /></>;
}