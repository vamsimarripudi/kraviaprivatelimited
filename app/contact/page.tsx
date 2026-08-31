import { Footer } from "@/components/footer";
import { ContactExperience } from "@/components/contact-experience";
import { PageHero } from "@/components/motion";
import { SiteNav } from "@/components/site-nav";
import { getPublicFormSetting } from "@/lib/admin/site-control";
import { yuktaProduct } from "@/lib/products/yukta";

export const metadata = { title: "Contact", description: "Contact Kravia for business, product, partnership, privacy or corporate enquiries." };

type ContactSearchParams = Promise<{ product?: string | string[] }>;

export default async function Contact({ searchParams }: { searchParams: ContactSearchParams }) {
  const [{ product }, presentation] = await Promise.all([searchParams, getPublicFormSetting("CONTACT")]);
  const selectedProduct = typeof product === "string" ? product.toLowerCase() : undefined;
  const initialCategory = selectedProduct === yuktaProduct.slug ? yuktaProduct.enquiryCategory : undefined;
  return <><SiteNav /><main id="main-content"><PageHero eyebrow="Contact" title="Start a considered conversation." intro="Choose the enquiry that best fits your reason for contacting Kravia." /><ContactExperience presentation={presentation} initialCategory={initialCategory} /></main><Footer /></>;
}