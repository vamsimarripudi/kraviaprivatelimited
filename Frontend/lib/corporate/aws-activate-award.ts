import type { PublicContentRecord } from "@/lib/content/types";

/**
 * Confirmed AWS Activate promotional cloud credits for KRAVIA.
 * This is a factual startup-program award, not an AWS partnership or endorsement.
 *
 * External publication and AWS Activate logo usage require AWS's prior written
 * permission. Do not merge/deploy this source-controlled release before the
 * owner's approval and AWS brand/communications clearance are documented.
 */
export const awsActivateAward = {
  program: "AWS Activate",
  amountUsd: 10000,
  expiresAt: "2028-11-30",
  artwork: "/newsroom/kravia-aws-activate-credits.jpg",
  disclaimer: "AWS Activate promotional credits are not an equity investment, commercial partnership, sponsorship, certification or endorsement of KRAVIA PRIVATE LIMITED or its products.",
} as const;

/** Owner-approved newsroom copy; deployment remains gated by AWS clearance. */
export const awsActivateNewsroomRecord: PublicContentRecord = {
  id: "e95b235f-6c5d-4423-a680-5a2b936934e5",
  type: "NEWS",
  slug: "kravia-aws-activate-credits",
  title: "KRAVIA PRIVATE LIMITED receives USD 10,000 in AWS Activate cloud credits",
  summary: "KRAVIA PRIVATE LIMITED has received USD 10,000 in AWS Activate promotional cloud credits, valid through 30 November 2028, to support eligible cloud development and infrastructure expenses.",
  body: [
    {
      type: "paragraph",
      text: "KRAVIA PRIVATE LIMITED has received USD 10,000 in promotional cloud credits through AWS Activate, a program that helps eligible startups build and experiment using Amazon Web Services. The award is reflected in KRAVIA's AWS account and is valid through 30 November 2028."
    },
    {
      type: "paragraph",
      text: "The credits can help offset qualifying AWS cloud expenses as KRAVIA evaluates infrastructure for its proprietary software products. Potential uses include eligible application hosting, data services, private storage, observability, testing and artificial intelligence development, subject to applicable credit terms and service eligibility."
    },
    {
      type: "paragraph",
      text: "KRAVIA's product portfolio includes VidyaLuma, its school intelligence and operations platform. The company will assess cloud services according to product requirements, responsible data handling and measurable technical needs rather than migrating workloads solely to use the award."
    },
    {
      type: "paragraph",
      text: "Following KRAVIA's membership in NVIDIA Inception, the AWS Activate credit award marks another step in the company's access to startup development resources. These are independent program benefits and do not establish a commercial partnership between KRAVIA and either organization."
    },
    {
      type: "paragraph",
      text: "AWS Activate credits are promotional service credits, not cash financing or an equity investment. They apply only to eligible AWS charges and expire under the terms of the award. Neither AWS nor AWS Activate has endorsed, certified or invested in KRAVIA or VidyaLuma through this credit award."
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
    title: "KRAVIA receives $10,000 in AWS Activate credits | Newsroom",
    description: "KRAVIA PRIVATE LIMITED receives USD 10,000 in AWS Activate promotional cloud credits, valid through 30 November 2028, for eligible cloud services.",
    canonicalPath: "/newsroom/kravia-aws-activate-credits",
    ogImage: awsActivateAward.artwork
  },
  relatedEntityIds: []
};
