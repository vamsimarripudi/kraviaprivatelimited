/** Owner-provided corporate profiles. Keep product-specific identities separate. */
export const publicCompanyLinks = {
  facebook: "https://www.facebook.com/profile.php?id=61595906774125",
  instagram: "https://www.instagram.com/kravia_private_limited/",
  x: "https://x.com/KraviaOfficial",
  linkedIn: "https://www.linkedin.com/company/kravia-private-limited/",
} as const;

export const publicSocialProfiles = [
  { key: "facebook", label: "Facebook", href: publicCompanyLinks.facebook },
  { key: "instagram", label: "Instagram", href: publicCompanyLinks.instagram },
  { key: "x", label: "X", href: publicCompanyLinks.x },
  { key: "linkedIn", label: "LinkedIn", href: publicCompanyLinks.linkedIn },
] as const;

export type SocialPlatform = (typeof publicSocialProfiles)[number]["key"];
