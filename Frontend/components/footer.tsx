import Link from "next/link";
import styles from "./footer.module.css";
import { BadgeCheck, ChevronDown, ExternalLink } from "lucide-react";
import { SocialLinks } from "./social-links";
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
    <footer className={styles.root} data-nav-theme="dark">
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <BrandLogo inverse />
            <p>Software products, intelligent systems and digital infrastructure.</p>
            <SocialLinks inverse />
          </div>
          <div className={styles.directory}>
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className={styles.label}>{column.title}</p>
                {column.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
              </nav>
            ))}
          </div>
          <div className={styles.mobileDirectory}>
            {footerColumns.map((column) => (
              <details key={column.title}>
                <summary>{column.title}<ChevronDown aria-hidden="true" /></summary>
                <nav aria-label={column.title}>
                  {column.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
                </nav>
              </details>
            ))}
          </div>
        </div>

        <section className={styles.identity} aria-label="Corporate identity">
          <dl className={styles.facts}>
            <div><dt>CIN</dt><dd>{profile.cin}</dd></div>
            <div><dt>GSTIN</dt><dd>{profile.gst.gstin}</dd></div>
            <div className={styles.address}><dt>Registered office</dt><dd>{profile.registeredOffice}</dd></div>
            <div className={styles.contact}><dt>Corporate contact</dt><dd>{profile.corporateEmail ? <a href={`mailto:${profile.corporateEmail}`}>{profile.corporateEmail}</a> : <Link href="/contact">Contact KRAVIA</Link>}</dd></div>
          </dl>
        </section>

        <section className={styles.recognitions} aria-label="Registrations and recognitions">
          <div className={styles.credentials}>
            {recognitions.map((recognition) => (
              <a key={recognition.reference} href={recognition.href} target="_blank" rel="noopener noreferrer" aria-label={`Verify ${recognition.title}, ${recognition.reference} (opens in a new tab)`}>
                <BadgeCheck className={styles.badge} aria-hidden="true" />
                <span><strong>{recognition.authority}</strong><span>{recognition.title}</span><code>{recognition.reference}</code></span>
                <ExternalLink className={styles.external} aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className={styles.note}>Recognition and registration identify the company only. They do not endorse KRAVIA products or services.</p>
        </section>

        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} {profile.legalName}. All rights reserved.</p>
          <div className={styles.legal}><span>{profile.country || "India"}</span>{legalLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
        </div>
      </div>
    </footer>
  );
}
