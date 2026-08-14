import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Footer } from "@/components/footer";
import { PageHero, Reveal } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { officialLinks, publicPages } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ segments: string[] }> }): Promise<Metadata> { const { segments } = await params; const key = segments.join("/"); const page = publicPages[key]; return page ? { title: page.eyebrow, description: page.intro, alternates: { canonical: `/${key}` } } : {}; }
export default async function PublicPage({ params }: { params: Promise<{ segments: string[] }> }) { const { segments } = await params; const key = segments.join("/"); const page = publicPages[key]; if (!page) notFound(); return <><SiteNav /><main><PageHero {...page} /><section className="content-grid shell">{page.sections.map((section, i) => <Reveal key={section.title} className="content-row"><span>0{i + 1}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></Reveal>)}</section>{key === "trust/data-protection" && <section className="official shell"><p className="eyebrow">Official Government Resources</p>{officialLinks.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} <ExternalLink size={15} /></a>)}</section>}{key === "contact" && <section className="shell"><Link className="button button-dark" href="/privacy-request">Submit a secure request <ArrowUpRight /></Link></section>}</main><Footer /></>; }
