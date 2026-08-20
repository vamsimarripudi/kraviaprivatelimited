import { Footer } from "@/components/footer";
import { TrustRequestPortal } from "@/components/trust-request-portal";
import { PageHero } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
export const metadata = { title: "Privacy request", robots: { index: false, follow: false } };
export default function PrivacyRequest() { return <><SiteNav /><main><PageHero eyebrow="Privacy request" title="A private route for your request." intro="Submit a privacy question, rights request, grievance or security concern. Your request is not public." /><section className="shell form-section"><TrustRequestPortal /></section></main><Footer /></>; }
