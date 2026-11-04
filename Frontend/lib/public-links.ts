export const publicCompanyLinks = {
  linkedIn: "https://linkedin.com/company/kravia-private-limited",
  x: "https://x.com/KraviaOfficial",
  instagram: "https://www.instagram.com/kravia_private_limited/",
  facebook: "https://www.facebook.com/people/Kravia/61595906774125/",
} as const;

export type SocialProfile = {
  platform: "linkedin" | "instagram" | "facebook" | "x";
  label: string;
  href: string;
};

// Publish only owner-approved profiles; keep URLs in the existing source of truth.
export const publicSocialProfiles: readonly SocialProfile[] = [
  { platform: "linkedin", label: "LinkedIn", href: publicCompanyLinks.linkedIn },
  { platform: "x", label: "X", href: publicCompanyLinks.x },
  { platform: "instagram", label: "Instagram", href: publicCompanyLinks.instagram },
  { platform: "facebook", label: "Facebook", href: publicCompanyLinks.facebook },
];
