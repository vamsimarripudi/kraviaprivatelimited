import { TrustRequestPortal } from "@/components/trust-request-portal";
import { PageHero } from "@/components/motion";
import { getPublicFormSetting } from "@/lib/admin/site-control";
export const metadata = { title: "Privacy request", robots: { index: false, follow: false } };
export default async function PrivacyRequest() { const presentation = await getPublicFormSetting("TRUST_REQUEST"); return <><main id="main-content"><PageHero eyebrow="Privacy request" title="A private route for your request." intro="Submit a privacy question, rights request, grievance or security concern. Your request is not public." /><section className="shell form-section"><TrustRequestPortal presentation={presentation} /></section></main></>; }
