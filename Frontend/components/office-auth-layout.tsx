import Link from "next/link";
import { Building2, Fingerprint, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import styles from "./office-auth-layout.module.css";

type Props = {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
  footerHref?: string;
  footerLabel?: string;
};

export function OfficeAuthLayout({
  children,
  eyebrow = "OFFICIAL ACCESS",
  title = "KRAVIA Office",
  description = "One private workspace for company operations, governance, people, finance and control.",
  footerHref = "/",
  footerLabel = "Return to corporate website",
}: Props) {
  return (
    <main className={styles.shell}>
      <section className={styles.brand} aria-label="KRAVIA Office identity">
        <div className={styles.glowOne} />
        <div className={styles.glowTwo} />
        <div className={styles.brandTop}>
          <BrandLogo />
          <span className={styles.identityLabel}>{eyebrow}</span>
        </div>

        <div className={styles.brandCopy}>
          <p className={styles.kicker}>OFFICIAL PRIVATE ACCESS PORTAL</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
          <p className={styles.identityNotice}>
            Operated by Kravia Private Limited at <b>www.kraviaprivatelimited.com</b> for employees and authorised advisers. It is not a customer or product sign-in.
          </p>
          <div className={styles.trustGrid}>
            <div><ShieldCheck /><span><b>Role controlled</b><small>Authority follows assigned access.</small></span></div>
            <div><Fingerprint /><span><b>MFA protected</b><small>High-assurance identity by default.</small></span></div>
            <div><Building2 /><span><b>Company owned</b><small>KRAVIA-managed identity and sessions.</small></span></div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          <span>Company-owned · Restricted · Audit aware</span>
          <Link href={footerHref}>{footerLabel}</Link>
        </div>
      </section>

      <section className={styles.formSide}>
        <div className={styles.mobileBrand}><BrandLogo /><b>OFFICIAL PRIVATE ACCESS</b></div>
        <div className={styles.card}>{children}</div>
        <p className={styles.copyright}>KRAVIA PRIVATE LIMITED · Authorized personnel only</p>
      </section>
    </main>
  );
}
