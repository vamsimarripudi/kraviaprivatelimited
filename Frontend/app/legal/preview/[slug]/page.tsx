import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { LegalDocument } from "@/components/legal-document";
import { SiteNav } from "@/components/site-nav";
import { loadLocalLegalDraft, localLegalPreviewEnabled } from "@/lib/legal/draft-loader";
import type { PublicContentRecord } from "@/lib/content/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Legal review preview", robots: { index: false, follow: false, nocache: true } };

export default async function LocalLegalPreview({ params }: { params: Promise<{ slug: string }> }) {
  if (!localLegalPreviewEnabled()) notFound();
  const { slug } = await params;
  const preview = await loadLocalLegalDraft(slug);
  if (!preview) notFound();
  const article: PublicContentRecord = {
    id: `local-${preview.candidate.id}`,
    type: "POLICY",
    slug: preview.candidate.slug,
    title: preview.candidate.title,
    summary: preview.body.overview,
    body: preview.body,
    status: "DRAFT",
    visibility: "PRIVATE",
    createdAt: preview.candidate.updatedAt,
    updatedAt: preview.candidate.updatedAt,
    version: 1,
    seo: { title: "Local legal review preview", description: "Local review-only rendering." },
  };
  return <><SiteNav /><main id="main-content"><LegalDocument article={article} /></main><Footer /></>;
}
