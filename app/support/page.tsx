import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { PageHero } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { SupportPortal } from "@/components/support-portal";
export const metadata: Metadata = { title: "Support & Case Tracking", description: "Create and securely track a Kravia support case." };
export default function SupportPage() { return <><SiteNav /><main><PageHero eyebrow="Support" title="Support that stays visible." intro="Create a support case and follow its customer-visible progress through a private reference and tracking code." /><SupportPortal /></main><Footer /></>; }