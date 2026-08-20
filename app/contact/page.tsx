import { Footer } from "@/components/footer";
import { ContactExperience } from "@/components/contact-experience";
import { PageHero } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { getPublicFormSetting } from "@/lib/admin/site-control";

export const metadata = { title: "Contact", description: "Contact Kravia for business, product, partnership, privacy or corporate enquiries." };

export default async function Contact() {
  const presentation = await getPublicFormSetting("CONTACT");
  return <><SiteNav /><main id="main-content"><PageHero eyebrow="Contact" title="Start a considered conversation." intro="Choose the enquiry that best fits your reason for contacting Kravia." /><ContactExperience presentation={presentation} /></main><Footer /></>;
}
