import Link from "next/link";
import { ArrowUpRight, BadgeCheck, ExternalLink, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { getPublicCompanyProfile } from "@/lib/corporate/public-facts";
import { getPublicCorporateRegistrations } from "@/lib/corporate/public-registrations";

const footerColumns = [
  {
    title: "Company",
    links: [
      ["About", "/company/about"],
      ["Leadership & Team", "/company/leadership"],
      ["Principles", "/company/principles"],
      ["Corporate information", "/company/corporate-information"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Products",
    links: [
      ["VidyaLuma", "/products/vidyaluma"],
      ["Nice Role", "/products/nicerole"],
      ["YUKTA", "/products/yukta"],
      ["VORIO", "/products/vorio"],
      ["Portfolio", "/products"],
      ["Technology", "/technology"],
      ["Applied AI", "/technology/ai"],
    ],
  },
  {
    title: "Trust & governance",
    links: [
      ["Trust Center", "/trust"],
      ["Security", "/trust/security"],
      ["Privacy", "/trust/privacy"],
      ["Data protection / DPDP", "/trust/data-protection"],
      ["Governance", "/governance"],
      ["Disclosures", "/disclosures"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Newsroom", "/newsroom"],
      ["Legal", "/legal"],
      ["Accessibility", "/trust/accessibility"],
      ["Security reporting", "/trust/security-reporting"],
      ["Support & case tracking", "/support"],
    ],
  },
] as const;

const legalLinks = [
  ["Privacy Policy", "/legal/privacy"],
  ["Terms of Use", "/legal/terms"],
  ["Cookie Policy", "/legal/cookies"],
  ["Accessibility", "/trust/accessibility"],
] as const;

export async function Footer() {
  const [profile, recognitions] = await Promise.all([getPublicCompanyProfile(), getPublicCorporateRegistrations()]);
  return (
    <footer className="footer corporate-footer">
      <div className="shell footer-brand-row">
        <div className="footer-brand-block">
          <BrandLogo inverse animated />
          <p className="eyebrow footer-eyebrow">KRAVIA PRIVATE LIMITED</p>
          <h2>Built for the work<br /><em>that comes next.</em></h2>
        </div>
        <p className="footer-intro">A corporate home for Kravia’s products, technology, trust and public information—designed to grow without losing clarity.</p>
      </div>


      <div className="shell footer-directory">
        {footerColumns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p>{column.title}</p>
            {column.links.map(([label, href]) => <Link key={label} href={href}>{label}<ArrowUpRight aria-hidden="true" /></Link>)}
          </nav>
        ))}
      </div>

      <div className="shell footer-corporate-directory">
        <section className="footer-corporate-identity" aria-labelledby="footer-corporate-identity-title">
          <div>
            <p className="eyebrow">CORPORATE IDENTITY</p>
            <h2 id="footer-corporate-identity-title">KRAVIA PRIVATE LIMITED</h2>
            <p>Approved statutory details for corporate and regulatory reference. Personal information and certificate files are not published here.</p>
          </div>
          <dl>
            <div><dt>CIN</dt><dd>{profile.cin}</dd></div>
            <div><dt>GSTIN</dt><dd>{profile.gst.gstin}</dd></div>
            <div className="footer-address"><dt><MapPin aria-hidden="true" /> Registered office</dt><dd>{profile.registeredOffice}</dd></div>
          </dl>
          <address className="footer-corporate-contact"><span>Corporate contact</span><a href={`mailto:${profile.corporateEmail}`}>{profile.corporateEmail}</a></address>
        </section>
        <section className="footer-recognitions" aria-labelledby="footer-recognitions-title">
          <div className="footer-recognitions-intro"><BadgeCheck aria-hidden="true" /><div><p className="eyebrow">REGISTRATIONS & RECOGNITIONS</p><h2 id="footer-recognitions-title">Company credentials.</h2></div></div>
          <div className="footer-recognition-grid">{recognitions.map((recognition) => <article key={recognition.reference}><BadgeCheck className="footer-recognition-mark" aria-hidden="true" /><div><p>{recognition.authority}</p><h3>{recognition.title}</h3><code>{recognition.reference}</code></div><a href={recognition.href} target="_blank" rel="noopener noreferrer" aria-label={`Verify ${recognition.authority} registration`}>Verify <ExternalLink aria-hidden="true" /></a></article>)}</div>
          <p className="footer-recognition-note">Recognition and registration identify the company only. They do not endorse KRAVIA products or services.</p>
        </section>
      </div>

      <div className="shell footer-bottom">
        <p>© {new Date().getFullYear()} KRAVIA PRIVATE LIMITED. All rights reserved.</p>
        <div><span>India</span>{legalLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
      </div>
    </footer>
  );
}
