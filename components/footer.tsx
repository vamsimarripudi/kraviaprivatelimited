import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const footerColumns = [
  {
    title: "Company",
    links: [
      ["About", "/company/about"],
      ["Principles", "/company/principles"],
      ["Corporate information", "/company/corporate-information"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Products",
    links: [
      ["VidyaLuma", "/products"],
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
    ],
  },
] as const;


export function Footer() {

  return (
    <footer className="footer corporate-footer">
      <div className="shell footer-brand-row">
        <div className="footer-brand-block">
          <BrandLogo inverse />
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


      <div className="shell footer-wordmark" aria-label="Kravia">
        <span>K</span><span>R</span><span>A</span><span>V</span><span>I</span><span>A</span>
      </div>
      <div className="shell footer-bottom">
        <p>© {new Date().getFullYear()} KRAVIA PRIVATE LIMITED. All rights reserved.</p>
        <div><span>India</span><Link href="/trust">Accessibility</Link><Link href="/trust/privacy">Privacy</Link></div>
      </div>
    </footer>
  );
}
