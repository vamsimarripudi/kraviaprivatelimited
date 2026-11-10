/** Owner-supplied public profiles and product identity assets. */
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
  contribution: string;
  portrait: LeadershipImage | null;
  email: string | null;
  linkedIn: `https://www.linkedin.com/in/${string}` | `https://linkedin.com/in/${string}` | null;
  portfolio?: `https://${string}` | null;
  publicationStatus: "approved" | "draft";
};

export const leadershipPath = "/company/leadership";
export const leadershipTitle = "Leadership & Team";
export const leadershipDescription = "Meet KRAVIA's leadership: Founder & CTO Vamsi Marripudi, Co-Founder & CEO Satish Manohar Pennada, and COO Jaya Satyanarayana Mangam.";

export const startupOverview = {
  heading: "The people building KRAVIA.",
  introduction: "An early-stage, founder-led Indian technology startup building purposeful software products.",
  stage: "Pre-revenue · Product development",
  founded: "2026",
  paragraphs: [
    "KRAVIA PRIVATE LIMITED is a product-focused technology company developing software, intelligent systems and digital infrastructure around practical organisational needs. We are currently in our pre-revenue product development stage, with VidyaLuma as our flagship product.",
    "Our three-person team covers product architecture, backend and frontend engineering, and company operations. Vamsi leads product planning and day-to-day technical execution, Satish focuses on backend engineering and VidyaLuma AI Tutor development, and Jaya coordinates operations alongside frontend development and product requirements.",
  ],
} as const;

export const defaultProfileImage: LeadershipImage = { src: "/team/default-profile.webp", width: 204, height: 192, objectPosition: "50% 50%" };

export const leadershipAssets: { vidyalumaLogo: LeadershipImage | null } = {
  vidyalumaLogo: { src: "/brand/vidyaluma-logo.png", width: 636, height: 474 },
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
      "Vamsi Marripudi is the Founder and Chief Technology Officer of KRAVIA PRIVATE LIMITED. He leads AI engineering, product architecture and hands-on software development.",
      "He directs technical execution across architecture, implementation and product development, turning functional requirements into reliable application and AI systems, including technical direction for VidyaLuma.",
    ],
    responsibilities: ["AI engineering", "Product architecture", "Full-stack development", "Day-to-day technical execution"],
    contribution: "AI Engineering & Product Architecture",
    portrait: { src: "/team/vamsi-marripudi.webp", width: 256, height: 256, objectPosition: "50% 50%" },
    email: "Vamsi@kraviaprivatelimited.com",
    linkedIn: "https://linkedin.com/in/vamsimarripudi/",
    portfolio: null,
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
      "Satish Manohar Pennada is KRAVIA's Co-Founder, Chief Executive Officer and Chief Financial Officer. His current product contribution focuses on backend engineering and VidyaLuma AI Tutor.",
      "He works on the AI Tutor's design and implementation, connecting backend services with the planned tutoring capabilities. The product remains in development.",
    ],
    responsibilities: ["Backend development", "VidyaLuma AI Tutor design", "Implementation and fulfilment", "Technical collaboration"],
    contribution: "Backend Engineering & VidyaLuma AI Tutor Design and Fulfilment",
    portrait: { src: "/team/satish-manohar-pennada.webp", width: 256, height: 256, objectPosition: "50% 50%" },
    email: "Satish@kraviaprivatelimited.com",
    linkedIn: "https://linkedin.com/in/satish-manohar-9699a2253/",
    publicationStatus: "approved",
  },
  {
    id: "jaya-satyanarayana-mangam",
    name: "Jaya Satyanarayana Mangam",
    initials: "JM",
    group: "team",
    title: "Chief Operating Officer (COO)",
    roleDetail: "Operations leadership · Frontend development",
    disciplines: ["Operations", "Frontend Development", "Product Documentation"],
    biography: [
      "Jaya Satyanarayana Mangam serves as Chief Operating Officer of KRAVIA PRIVATE LIMITED. He coordinates company operations, product requirements and frontend development.",
      "His work connects operational responsibilities, implementation-ready requirements and frontend execution with the engineering team, supporting clear ownership and accountable product delivery.",
    ],
    responsibilities: ["Company operations coordination", "Frontend development", "Product requirements and documentation", "Engineering hand-offs"],
    contribution: "Operations Coordination & Frontend Development",
    portrait: { src: "/team/jaya-satyanarayana-mangam.webp", width: 256, height: 256, objectPosition: "50% 50%" },
    email: "Satyanarayana@kraviaprivatelimited.com",
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
        ...(person.email ? { email: person.email } : {}),
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
