import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/search-metadata";
import { PageHero } from "@/components/motion";
import { SupportPortal } from "@/components/support-portal";
import { publicCorporateEmails } from "@/lib/corporate/public-email-directory";
export const metadata: Metadata = buildPublicMetadata({ title: "Support & Case Tracking", description: "Create and securely track a Kravia support case.", path: "/support" });
export default function SupportPage() { return <><main id="main-content"><PageHero eyebrow="Support" title="Support that stays visible." intro="Create a support case and follow its customer-visible progress through a private reference and tracking code." /><SupportPortal /><section className="shell"><p>For general support by email, contact <a href={`mailto:${publicCorporateEmails.support}`}>{publicCorporateEmails.support}</a>. Use the form above if you need a trackable case reference.</p></section></main></>; }
