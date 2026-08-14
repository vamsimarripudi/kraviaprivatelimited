import { Footer } from "@/components/footer";
import { EnquiryForm } from "@/components/enquiry-form";
import { PageHero } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
export const metadata = { title: "Contact", description: "Contact Kravia for business, product, partnership, privacy or corporate enquiries." };
export default function Contact() { return <><SiteNav /><main><PageHero eyebrow="Contact" title="Start a considered conversation." intro="Choose the enquiry that best fits your reason for contacting Kravia." /><section className="shell form-section"><EnquiryForm /></section></main><Footer /></>; }
