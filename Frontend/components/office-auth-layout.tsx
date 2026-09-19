import Link from "next/link";
import { Building2, Fingerprint, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
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
  eyebrow = "KRAVIA PRIVATE LIMITED",
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
          <div className={styles.mark} aria-hidden="true">K</div>
          <span>{eyebrow}</span>
        </div>

        <div className={styles.brandCopy}>
          <p className={styles.kicker}>PRIVATE COMPANY OPERATING SYSTEM</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
          <div className={styles.trustGrid}>
            <div><ShieldCheck /><span><b>Role controlled</b><small>Authority follows assigned access.</small></span></div>
            <div><Fingerprint /><span><b>MFA protected</b><small>High-assurance identity by default.</small></span></div>
            <div><Building2 /><span><b>Company owned</b><small>KRAVIA-managed identity and sessions.</small></span></div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          <span>Internal · Confidential · Audit aware</span>
          <Link href={footerHref}>{footerLabel}</Link>
        </div>
      </section>

      <section className={styles.formSide}>
        <div className={styles.mobileBrand}><span className={styles.mobileMark}>K</span><b>KRAVIA Office</b></div>
        <div className={styles.card}>{children}</div>
        <p className={styles.copyright}>KRAVIA PRIVATE LIMITED · Authorized personnel only</p>
      </section>
    </main>
  );
}
