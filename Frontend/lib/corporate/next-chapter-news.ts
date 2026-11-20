import type { PublicContentRecord } from "@/lib/content/types";

/**
 * Owner-authorized, KRAVIA-only corporate progress update.
 * This is separate from the AWS Activate promotional-credit announcement:
 * it includes no AWS name, AWS marks, credit amount, or pending award claim.
 * Reuse the existing approved KRAVIA logo unchanged in the article reader.
 */
export const kraviaNextChapterNewsroomRecord: PublicContentRecord = {
  id: "c9cd235a-78c6-427d-9321-c9c3c0a897f8",
  type: "NEWS",
  slug: "kravia-new-chapter-building-technology-products",
  title: "A new chapter is taking shape at KRAVIA",
  summary: "KRAVIA PRIVATE LIMITED continues building proprietary software products, including VidyaLuma, with an emphasis on practical engineering and responsible innovation.",
  body: [
    {
      type: "paragraph",
      text: "A new chapter is taking shape at KRAVIA PRIVATE LIMITED. From establishing the company to becoming a member of NVIDIA Inception, our journey has focused on one objective: building technology products that address real operational needs."
    },
    {
      type: "paragraph",
      text: "We are strengthening the technical foundation of our proprietary software products, including VidyaLuma, a school intelligence and operations platform designed to make everyday academic and administrative work clearer."
    },
    {
      type: "paragraph",
      text: "We believe meaningful progress comes from disciplined product engineering, dependable systems and responsible use of emerging technologies. Our work is centered on usefulness, reliability and long-term value."
    },
    {
      type: "paragraph",
      text: "More verified company milestones will be shared through the KRAVIA Newsroom as they are ready for public announcement."
    },
    {
      type: "paragraph",
      text: "Ideas become systems. Systems become products."
    }
  ],
  status: "PUBLISHED",
  visibility: "PUBLIC",
  createdAt: "2026-11-20",
  updatedAt: "2026-11-20",
  publishedAt: "2026-11-20",
  version: 1,
  category: "Company milestone",
  authorName: "KRAVIA PRIVATE LIMITED",
  contentOwner: "KRAVIA PRIVATE LIMITED",
  seo: {
    title: "A new chapter is taking shape at KRAVIA | Newsroom",
    description: "KRAVIA PRIVATE LIMITED advances its proprietary technology products, including VidyaLuma, following its NVIDIA Inception startup-program membership.",
    canonicalPath: "/newsroom/kravia-new-chapter-building-technology-products",
    ogImage: "/brand/kravia-header-lockup-v2.png"
  },
  relatedEntityIds: []
};
