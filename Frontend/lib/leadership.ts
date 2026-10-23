/** Owner-supplied public profiles. Portraits and logo stay unset until approved assets arrive. */
export type LeadershipImage = {
  src: `/team/${string}` | `/brand/${string}`;
  width: number;
  height: number;
  objectPosition?: string;
};

export type TeamProfile = {
  id: string;
  name: string;
  initials: string;
  group: "founder" | "team";
  title: string;
  roleDetail: string;
  disciplines: readonly string[];
  biography: readonly string[];
  responsibilities: readonly string[];
  portrait: LeadershipImage | null;
  email: string;
  linkedIn: `https://www.linkedin.com/in/${string}` | null;
  portfolio?: `https://${string}` | null;
  publicationStatus: "approved" | "draft";
};

export const leadershipPath = "/company/leadership";
export const leadershipTitle = "Leadership & Team";
export const leadershipDescription = "Meet Vamsi Marripudi, Satish Manohar Pennada and Jaya Satyanarayana Mangam, the founders and team behind KRAVIA and its flagship product, VidyaLuma.";

export const startupOverview = {
  heading: "The people building KRAVIA.",
  introduction: "An early-stage, founder-led Indian technology startup building purposeful software products.",
  stage: "Pre-revenue · Product development",
  founded: "2026",
  paragraphs: [
    "KRAVIA PRIVATE LIMITED is a product-focused technology company developing software, intelligent systems and digital infrastructure around practical organisational needs. We are currently in our pre-revenue product development stage, with VidyaLuma as our flagship product.",
    "Our three-person team brings together technology leadership, business oversight, frontend development and market development. Product building and day-to-day technical execution are led by Vamsi, with distinct responsibilities across the founding leadership and team.",
  ],
} as const;

export const defaultProfileImage: LeadershipImage = { src: "/team/default-profile.webp", width: 204, height: 192, objectPosition: "50% 50%" };

export const leadershipAssets: { vidyalumaLogo: LeadershipImage | null } = {
  vidyalumaLogo: null,
};

export const teamProfiles: readonly TeamProfile[] = [
  {
    id: "vamsi-marripudi",
    name: "Vamsi Marripudi",
    initials: "VM",
    group: "founder",
    title: "Founder & CTO",
    roleDetail: "Chief Technology Officer",
    disciplines: ["Product Architect", "Full-Stack Developer", "Director"],
    biography: [
      "Vamsi Marripudi is the Founder and Chief Technology Officer of KRAVIA PRIVATE LIMITED. He leads product architecture, technology strategy and hands-on software development.",
      "He is responsible for product planning and day-to-day technical execution, connecting user needs with system design, frontend and backend engineering, and implementation. His focus is on turning practical operational challenges into useful software products, beginning with VidyaLuma.",
    ],
    responsibilities: ["Product architecture", "Full-stack engineering", "Technical strategy", "Day-to-day execution"],
    portrait: null,
    email: "vamsi@kraviaprivatelimited.com",
    linkedIn: "https://www.linkedin.com/in/vamsimarripudi",
    portfolio: "https://vamsimarripudi.me",
    publicationStatus: "approved",
  },
  {
    id: "satish-manohar-pennada",
    name: "Satish Manohar Pennada",
    initials: "SP",
    group: "founder",
    title: "Co-Founder, CEO & CFO",
    roleDetail: "Chief Executive Officer & Chief Financial Officer",
    disciplines: ["Full-Stack Developer", "Director"],
    biography: [
      "Satish Manohar Pennada is the Co-Founder, Chief Executive Officer and Chief Financial Officer of KRAVIA PRIVATE LIMITED. His remit covers business planning, financial oversight and company operations.",
      "As a full-stack developer, he also contributes a technical perspective to engineering review and collaboration. His role connects business oversight with the company's product direction as KRAVIA prepares for market entry.",
    ],
    responsibilities: ["Business planning", "Financial oversight", "Company operations", "Engineering review"],
    portrait: null,
    email: "satishmanohar7@gmail.com",
    linkedIn: "https://www.linkedin.com/in/satish-manohar-9699a2253/",
    publicationStatus: "approved",
  },
  {
    id: "jaya-satyanarayana-mangam",
    name: "Jaya Satyanarayana Mangam",
    initials: "JM",
    group: "team",
    title: "Frontend Developer & Marketing and Sales Lead",
    roleDetail: "Product interfaces · Marketing · Sales",
    disciplines: ["Frontend Development", "Market Development"],
    biography: [
      "Jaya Satyanarayana Mangam is part of KRAVIA's team, with responsibilities spanning frontend development, marketing and sales.",
      "His focus is on supporting user-facing product experiences, communicating product value and developing customer outreach with the founding team. His work connects product presentation with market development as KRAVIA builds its initial market presence.",
    ],
    responsibilities: ["Frontend implementation", "Product communication", "Marketing coordination", "Sales outreach"],
    portrait: null,
    email: "jayasatyanarayana7@gmail.com",
    linkedIn: null,
    publicationStatus: "approved",
  },
];

export function publishedTeam(profiles: readonly TeamProfile[] = teamProfiles): readonly TeamProfile[] {
  return profiles.filter((profile) => profile.publicationStatus === "approved");
}

export function teamPersonId(origin: string, id: string): string {
  return `${origin.replace(/\/$/, "")}${leadershipPath}#${id}`;
}

/** Extends the site's existing company entity rather than defining a second company. */
export function leadershipRelationships(origin: string, profiles: readonly TeamProfile[] = teamProfiles) {
  const people = publishedTeam(profiles);
  return {
    founder: people.filter((person) => person.group === "founder").map((person) => ({ "@id": teamPersonId(origin, person.id) })),
    member: people.filter((person) => person.group === "team").map((person) => ({ "@id": teamPersonId(origin, person.id) })),
  };
}

export function leadershipJsonLd(origin: string, profiles: readonly TeamProfile[] = teamProfiles) {
  const base = origin.replace(/\/$/, "");
  const people = publishedTeam(profiles);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${base}${leadershipPath}#page`,
        url: `${base}${leadershipPath}`,
        name: leadershipTitle,
        description: leadershipDescription,
        about: { "@id": `${base}#organization` },
        mainEntity: people.map((person) => ({ "@id": teamPersonId(base, person.id) })),
      },
      ...people.map((person) => ({
        "@type": "Person",
        "@id": teamPersonId(base, person.id),
        name: person.name,
        url: teamPersonId(base, person.id),
        jobTitle: person.title,
        email: person.email,
        description: person.biography.join(" "),
        worksFor: { "@id": `${base}#organization` },
        ...(person.portrait ? { image: `${base}${person.portrait.src}` } : {}),
        ...((person.linkedIn || person.portfolio) ? { sameAs: [person.linkedIn, person.portfolio].filter(Boolean) } : {}),
      })),
    ],
  };
}

export function serializeLeadershipJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
