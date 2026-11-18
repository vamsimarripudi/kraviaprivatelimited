/**
 * Reviewed, human-curated KRAVIA product updates. Publishing a development note
 * is not evidence of a production rollout. Never auto-publish raw Git commits.
 */
export type ProductReleaseNote = {
  slug: string;
  product: "VidyaLuma" | "Nice Role" | "YUKTA" | "VORIO";
  publishedOn: string;
  type: "Development" | "Improvement" | "Beta" | "General availability" | "Fix" | "Retirement";
  title: string;
  summary: string;
  availability: string;
  audience: readonly string[];
  built: readonly { title: string; description: string }[];
  workflow: readonly string[];
  safeguards: readonly string[];
  beforeRelease: readonly string[];
  references: readonly { label: string; href: string }[];
};

export const productReleaseNotes: readonly ProductReleaseNote[] = [
  {
    slug: "vidyaluma-connect-development",
    product: "VidyaLuma",
    publishedOn: "2026-11-19",
    type: "Development",
    title: "Introducing the VidyaLuma Connect development programme",
    summary: "VidyaLuma Connect is a school-controlled communication workspace being developed for authorised school teams. It brings direct conversations, relevant groups, messages and governed school updates into the same operational context as the rest of VidyaLuma.",
    availability: "Engineering implementation in the codebase; production availability and school activation have not been verified.",
    audience: ["School leadership", "Principals and administrators", "Teachers and authorised staff"],
    built: [
      {
        title: "Conversations that respect the school boundary",
        description: "A conversation service supports direct messages and school-defined groups, including class, subject, team and operational contexts. Membership is evaluated against authenticated roles and the school to which a user belongs.",
      },
      {
        title: "Messages with continuity",
        description: "The core service records ordered messages, read progress, acknowledgements, controlled edits, reactions and a durable delivery outbox. Retry identifiers help prevent accidental duplicates when a send needs to be confirmed.",
      },
      {
        title: "School updates alongside conversations",
        description: "Announcements and restricted broadcasts use governed school workflows, with recipient controls and acknowledgement paths rather than unrestricted mass messaging.",
      },
      {
        title: "Private attachment controls",
        description: "Attachment handling has bounded file types and sizes, private upload intents, validation and authorised retrieval. Transfer remains dependent on correctly configured and verified private storage.",
      },
      {
        title: "A connected web and mobile foundation",
        description: "A school web workspace and a server-gated mobile panel provide a conversation list, messages and a composer. The web implementation includes search, loading and offline states, with authenticated reconnect and event-cursor handling.",
      },
      {
        title: "An additional secure-message foundation",
        description: "A separate ciphertext-only, signed-envelope service boundary is implemented as a controlled foundation. It is not yet an activated end-to-end encrypted chat experience.",
      },
    ],
    workflow: [
      "A signed-in school user opens Connect and sees only conversations that their school membership permits.",
      "An authorised user opens a thread or establishes an eligible group. School identity and membership are checked by the service, not accepted from the browser as authority.",
      "Participants can exchange messages and, when private storage is configured, approved attachments. Read progress and message acknowledgements maintain context.",
      "School notices and follow-up actions remain subject to the relevant school approval and access policies.",
    ],
    safeguards: [
      "Different schools must not be able to read or join each other's conversations. Removed or revoked participants must lose access.",
      "Standard Connect messages are server-readable for authorised school workflows; they should not be described as end-to-end encrypted.",
      "The separate secure-envelope foundation is not being promoted as a consumer-ready encrypted messenger. Key distribution, recovery and safeguarding policy still require approval and device testing.",
      "Internal staff-only content, student information and private attachment links must not appear in public update records.",
    ],
    beforeRelease: [
      "Complete authenticated school-browser tests, permission-negative cases and cross-school access verification.",
      "Verify the private file-storage integration and attachment lifecycle in the intended production environment.",
      "Test mobile devices, reconnect behaviour, revoked sessions and message recovery with approved school identities.",
      "Approve retention, edit windows, moderation/safeguarding, account recovery and any optional encrypted messaging policy.",
      "Complete production recovery, migration, monitoring, performance and rollback checks before announcing live availability.",
      "Confirm plan entitlements, enablement and school-facing documentation on the official VidyaLuma product site.",
    ],
    references: [
      { label: "Official VidyaLuma website", href: "https://vidyaluma.in" },
      { label: "Product capabilities", href: "https://vidyaluma.in/product" },
      { label: "Trust and data practices", href: "https://vidyaluma.in/trust" },
    ],
  },
] as const;

export type ReleaseNotesFilter = {
  product?: string;
  type?: string;
  query?: string;
  sort?: "newest" | "oldest";
};

export function releaseNoteSearchText(note: ProductReleaseNote): string {
  return [
    note.product, note.title, note.type, note.summary, note.availability,
    ...note.audience,
    ...note.built.flatMap((item) => [item.title, item.description]),
    ...note.workflow, ...note.safeguards, ...note.beforeRelease,
  ].join(" ").toLocaleLowerCase();
}

export function filterProductReleaseNotes(filter: ReleaseNotesFilter = {}): ProductReleaseNote[] {
  const query = (filter.query || "").trim().toLocaleLowerCase();
  const matches = productReleaseNotes.filter((note) =>
    (!filter.product || filter.product === "All" || note.product === filter.product) &&
    (!filter.type || filter.type === "All" || note.type === filter.type) &&
    (!query || releaseNoteSearchText(note).includes(query))
  );
  return [...matches].sort((a, b) =>
    (filter.sort === "oldest" ? 1 : -1) *
    (a.publishedOn.localeCompare(b.publishedOn) || a.slug.localeCompare(b.slug))
  );
}
