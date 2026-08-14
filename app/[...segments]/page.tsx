import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { PageHero, Reveal } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { publicPages } from "@/lib/site";
import { PublicPageContent } from "@/components/public-page-content";

export async function generateMetadata({ params }: { params: Promise<{ segments: string[] }> }): Promise<Metadata> { const { segments } = await params; const key = segments.join("/"); const page = publicPages[key]; return page ? { title: page.eyebrow, description: page.intro, alternates: { canonical: `/${key}` } } : {}; }
export default async function PublicPage({ params }: { params: Promise<{ segments: string[] }> }) { const { segments } = await params; const key = segments.join("/"); const page = publicPages[key]; if (!page) notFound(); const enhanced = <PublicPageContent slug={key} />; return <><SiteNav /><main><PageHero {...page} />{enhanced ?? <section className="content-grid shell">{page.sections.map((section, i) => <Reveal key={section.title} className="content-row"><span>0{i + 1}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></Reveal>)}</section>}{key === "contact" && <section className="shell"><Link className="button button-dark" href="/privacy-request">Submit a secure request <ArrowUpRight /></Link></section>}</main><Footer /></>; }
