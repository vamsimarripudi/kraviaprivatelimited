import Link from "next/link";
import { Building2, ExternalLink, FileBadge2, Landmark, Mail, MapPin, ReceiptText, ShieldCheck } from "lucide-react";
import { CopyCorporateDetail } from "@/components/copy-corporate-detail";
import { CorporateRecognitions } from "@/components/corporate-recognitions";
import { corporateIdentity } from "@/lib/corporate-content";
import type { PublicCompanyProfile } from "@/lib/corporate/public-facts";

type CorporateField = { label: string; value: string | null; copy?: boolean; href?: string };

function CorporateFields({ fields }: { fields: readonly CorporateField[] }) {
  return <dl className="corporate-detail-list">{fields.filter((field) => field.value).map((field) => <div key={field.label}>
    <dt>{field.label}</dt>
    <dd>{field.href && field.value ? <a href={field.href}>{field.value}</a> : field.value}{field.copy && field.value ? <CopyCorporateDetail label={field.label} value={field.value} /> : null}</dd>
  </div>)}</dl>;
}

function CorporateSection({ number, icon: Icon, title, children }: { number: string; icon: typeof Building2; title: string; children: React.ReactNode }) {
  return <section className="corporate-information-section">
    <div className="corporate-information-marker"><span>{number}</span><Icon aria-hidden="true" /></div>
    <div><h2>{title}</h2>{children}</div>
  </section>;
}

const officialResources = [
  { label: "MCA corporate services", href: "https://www.mca.gov.in/", note: "Use the Ministry of Corporate Affairs portal for current company-data services." },
  { label: "GST taxpayer search", href: "https://services.gst.gov.in/services/searchtp", note: "Use the official GST portal to search a registered taxpayer." },
  { label: "Startup India certificate validation", href: "https://www.startupindia.gov.in/content/sih/en/startupgov/validate-startup-recognition.html", note: "Use the recognition number or entity name on the official Startup India service." },
  { label: "Udyam registration verification", href: "https://udyamregistration.gov.in/SearchRegDetail.aspx", note: "Use the official Udyam service to verify an MSME registration." },
] as const;

export function CorporateInformationPage({ profile }: { profile: PublicCompanyProfile }) {
  return <div className="corporate-information-page shell">
    <CorporateSection number="01" icon={Building2} title="Company overview">
      <p>KRAVIA PRIVATE LIMITED is an Indian technology company. This page is the controlled public reference for approved corporate particulars, registrations and recognition information.</p>
    </CorporateSection>

    <CorporateSection number="02" icon={Landmark} title="Legal identity">
      <CorporateFields fields={[
        { label: "Legal entity", value: profile.legalName },
        { label: "Entity type", value: profile.companyType },
        { label: "Country of incorporation", value: profile.country },
        { label: "Incorporation date", value: profile.incorporationDate },
        { label: "CIN", value: profile.cin, copy: true },
        { label: "PAN", value: corporateIdentity.pan, copy: true },
      ]} />
    </CorporateSection>

    <CorporateSection number="03" icon={ReceiptText} title="Tax registration">
      <CorporateFields fields={[
        { label: "GST registration", value: profile.gst.registered ? "Registered" : null },
        { label: "GSTIN", value: profile.gst.gstin, copy: true },
      ]} />
      <p className="corporate-section-note">GST registration identifies the company for tax purposes. It does not represent product certification or a government endorsement.</p>
    </CorporateSection>

    <CorporateSection number="04" icon={FileBadge2} title="DPIIT Startup Recognition">
      <CorporateFields fields={[
        { label: "Programme", value: "Startup India" },
        { label: "Status", value: corporateIdentity.dpiit.statusLabel },
        { label: "Recognition number", value: corporateIdentity.dpiit.recognitionNumber, copy: true },
      ]} />
      <p className="corporate-section-note">DPIIT recognition applies to the company. It is not an approval, certification or endorsement of any KRAVIA product or service.</p>
    </CorporateSection>

    <CorporateSection number="05" icon={ShieldCheck} title="Udyam MSME Registration">
      <CorporateFields fields={[
        { label: "Programme", value: "Udyam MSME" },
        { label: "Classification", value: corporateIdentity.udyam.classification },
        { label: "Registration number", value: corporateIdentity.udyam.registrationNumber, copy: true },
      ]} />
      <p className="corporate-section-note">This record describes MSME registration for the company. It does not imply product quality, procurement eligibility or performance certification.</p>
    </CorporateSection>

    <CorporateSection number="06" icon={MapPin} title="Registered office">
      <CorporateFields fields={[{ label: "Address", value: profile.registeredOffice, copy: true }]} />
      <p className="corporate-section-note">The original incorporation certificate records an earlier address. The current address above follows the later MCA master-data evidence supplied by KRAVIA and the owner-confirmed company record; no live MCA lookup was performed as part of this update.</p>
    </CorporateSection>

    <CorporateSection number="07" icon={ExternalLink} title="Official verification resources">
      <div className="corporate-resource-grid">{officialResources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noopener noreferrer"><span>{resource.label}</span><p>{resource.note}</p><ExternalLink aria-hidden="true" /></a>)}</div>
    </CorporateSection>

    <CorporateSection number="08" icon={Mail} title="Corporate contact & grievance information">
      <CorporateFields fields={[
        { label: "Corporate enquiries", value: profile.corporateEmail, href: profile.corporateEmail ? `mailto:${profile.corporateEmail}` : undefined },
        { label: "Telephone", value: profile.telephone, href: profile.telephone ? `tel:${profile.telephone.replace(/\s/g, "")}` : undefined },
      ]} />
      <p className="corporate-section-note">For a privacy, data-rights or grievance request, use the restricted <Link href="/privacy-request">Privacy Request channel</Link>. A named statutory grievance officer is not stated here unless and until KRAVIA publishes that appointment.</p>
    </CorporateSection>

    <CorporateRecognitions />
  </div>;
}
