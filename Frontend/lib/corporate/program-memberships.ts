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

/** Owner-only newsletter starter copy, not a published/sent campaign.
 * The newsletter manager requires an explicit save, separate approval and
 * a further explicit owner-authorised send for confirmed subscribers.
 */
export const nvidiaInceptionNewsletterDraft = {
  subject: "KRAVIA joins NVIDIA Inception",
  body: [
    "KRAVIA PRIVATE LIMITED is now a member of NVIDIA Inception, a program supporting technology startups.",
    "Through this membership, our team has access to NVIDIA Inception technical resources and eligible member opportunities as we continue developing KRAVIA-owned software platforms.",
    "Our flagship product, VidyaLuma, focuses on connected school operations, academic workflows, reporting and responsible AI-assisted tools. We will continue building and improving our products with a focus on reliability, privacy and practical usefulness.",
    "NVIDIA Inception membership is a startup-program milestone. It does not represent NVIDIA investment, certification, a commercial partnership or endorsement of our products.",
    "KRAVIA startup profile: https://www.kraviaprivatelimited.com/company/startup-profile",
    "VidyaLuma: https://vidyaluma.in/",
    "Learn about NVIDIA Inception: https://www.nvidia.com/en-in/startups/",
    "KRAVIA PRIVATE LIMITED",
  ].join("\n\n"),
} as const;
