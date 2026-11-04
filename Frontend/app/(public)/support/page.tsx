import type { Metadata } from "next";
import { PageHero } from "@/components/motion";
import { SupportPortal } from "@/components/support-portal";
import { getPublicFormSetting } from "@/lib/admin/site-control";
export const metadata: Metadata = { title: "Support & Case Tracking", description: "Create and securely track a Kravia support case." };
export default function SupportPage() { return <><main id="main-content"><PageHero eyebrow="Support" title="Support that stays visible." intro="Create a support case and follow its customer-visible progress through a private reference and tracking code." /><SupportPortal /></main></>; }
