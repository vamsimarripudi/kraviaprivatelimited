import type { PublicContentRecord } from "@/lib/content/types";

/** Public, owner-confirmed startup-program membership.
 * Badge asset matches the official RGB SVG supplied by NVIDIA Inception;
 * the SVG is already used by KRAVIA's footer and is not modified here.
 * Member status does not imply endorsement, investment or certification.
 */
export const nvidiaInceptionMembership = {
  program: "NVIDIA Inception",
  status: "Member",
  badge: "/brand/partners/nvidia-inception-member-rgb.svg",
  url: "https://www.nvidia.com/en-in/startups/",
  description: "KRAVIA PRIVATE LIMITED is a member of NVIDIA Inception, a program supporting technology startups with technical resources, ecosystem opportunities and selected member benefits.",
  disclaimer: "Program membership does not mean NVIDIA has funded, certified, partnered with or endorsed KRAVIA, VidyaLuma or any KRAVIA product.",
} as const;

/**
 * Owner-approved, source-controlled corporate milestone.
 * Kept distinct from pending drafts and review queues. If a later approved
 * publication exists at the same canonical path, it takes precedence.
 * The owner explicitly requested a Newsroom announcement, not an email campaign.
 */
export const nvidiaInceptionNewsroomRecord: PublicContentRecord = {
  id: "8e2624a8-08c3-4596-8db4-97dbd8824344",
  type: "NEWS",
  slug: "kravia-joins-nvidia-inception",
  title: "KRAVIA PRIVATE LIMITED joins NVIDIA Inception",
  summary: "KRAVIA PRIVATE LIMITED has been accepted into NVIDIA Inception, a startup program providing access to resources and opportunities for technology startups.",
  body: [
    {
      type: "paragraph",
      text: "KRAVIA PRIVATE LIMITED is now an official member of NVIDIA Inception, a program designed to support technology startups developing innovative products."
    },
    {
      type: "paragraph",
      text: "The membership gives eligible startups access to technical resources, learning opportunities, preferred offers and an ecosystem of partners. These resources can help our team as we continue developing proprietary software platforms."
    },
    {
      type: "paragraph",
      text: "Our flagship product, VidyaLuma, is a school intelligence and operations platform focused on connected academic workflows, administration, teacher-reviewed reporting and responsible AI-assisted tools."
    },
    {
      type: "paragraph",
      text: "This is a company milestone and a startup-program membership. It does not mean NVIDIA has invested in KRAVIA, endorsed or certified its products, or entered into a commercial partnership with KRAVIA."
    },
    {
      type: "paragraph",
      text: "We will continue building KRAVIA-owned products with an emphasis on useful software, reliability, privacy and accountable engineering."
    }
  ],
  status: "PUBLISHED",
  visibility: "PUBLIC",
  createdAt: "2026-11-13",
  updatedAt: "2026-11-13",
  publishedAt: "2026-11-13",
  version: 1,
  category: "Company milestone",
  authorName: "KRAVIA PRIVATE LIMITED",
  contentOwner: "KRAVIA PRIVATE LIMITED",
  seo: {
    title: "KRAVIA joins NVIDIA Inception | Company News",
    description: "KRAVIA PRIVATE LIMITED joins NVIDIA Inception as a startup-program member. Learn what the milestone means for its proprietary software products.",
    canonicalPath: "/newsroom/kravia-joins-nvidia-inception",
    ogImage: nvidiaInceptionMembership.badge
  },
  relatedEntityIds: []
};
