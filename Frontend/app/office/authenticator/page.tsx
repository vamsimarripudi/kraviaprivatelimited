import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { OfficeAuthLayout } from "@/components/office-auth-layout";
import {
  GOOGLE_PLAY_BADGE_IMAGE_URL,
  KRAVIA_AUTHENTICATOR_PLAY_STORE_URL,
} from "@/lib/office/authenticator-store";
import styles from "./authenticator.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Authenticator | Office MFA",
  description: "Install the official KRAVIA Authenticator and activate your phone with corporate credentials and trusted Office approval.",
  alternates: { canonical: "/office/authenticator" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const steps = [
  {
    Icon: Smartphone,
    title: "1 · Prepare your phone",
    copy: "Use a company-approved Android phone with a device passcode and strong biometric protection enabled.",
  },
  {
    Icon: KeyRound,
    title: "2 · Sign in to activate",
    copy: "Enter your corporate credentials and the six-digit code sent to your registered email. This starts a protected phone request, not an Office browser session.",
  },
  {
    Icon: ShieldCheck,
    title: "3 · Approve the request",
    copy: "A verified Office owner or authorised administrator reviews the phone activation request.",
  },
  {
    Icon: LockKeyhole,
    title: "4 · Verify six digits",
    copy: "Return to Office and enter the current Authenticator code to complete protected sign-in.",
  },
] as const;

const roles = [
  "Owner", "Director", "Admin", "Member", "Finance", "CA",
  "CS", "Legal", "HR", "Operations", "Auditor", "Product Admin",
];

function secureUrl(value: string | undefined) {
  const candidate = value?.trim();
  return candidate?.startsWith("https://") ? candidate : undefined;
}

export default function KraviaAuthenticatorPage() {
  const iosUrl = secureUrl(process.env.KRAVIA_AUTHENTICATOR_IOS_URL);

  return (
    <OfficeAuthLayout
      eyebrow="MANDATORY SECOND FACTOR"
      title="Authenticator"
      description="Protecting every KRAVIA Office and Finance role."
      footerHref="/office/login"
      footerLabel="Back to Office sign in"
    >
      <div className={styles.page} data-kravia-authenticator-install>
        <header className={styles.intro}>
          <span className={styles.icon}><ShieldCheck aria-hidden="true" size={23} /></span>
          <div>
            <p className={styles.eyebrow}>OFFICIAL KRAVIA AUTHENTICATOR</p>
            <h2>Activate your phone</h2>
          </div>
        </header>

        <p className={styles.description}>
          Install KRAVIA Authenticator from Google Play, then use your corporate
          credentials to request protected phone activation. A verified Office
          owner or administrator must approve the device before it can generate
          six-digit codes. Your password is never stored on the phone.
        </p>

        <section className={styles.download} aria-label="Download KRAVIA Authenticator">
          <div className={styles.downloadCopy}>
            <strong>Install the Android app</strong>
            <span>Official Google Play listing · KRAVIA Authenticator</span>
          </div>
          <a
            className={styles.playBadge}
            href={KRAVIA_AUTHENTICATOR_PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get KRAVIA Authenticator on Google Play (opens in a new tab)"
          >
            <Image
              src={GOOGLE_PLAY_BADGE_IMAGE_URL}
              alt="Get it on Google Play"
              width={194}
              height={75}
              unoptimized
            />
          </a>
          <p className={styles.downloadHint}>
            Select the official Google Play badge to open the app listing and install.
            Do not install APKs from messages or third-party websites.
          </p>
        </section>

        <div className={styles.steps} aria-label="Phone activation instructions">
          {steps.map(({ Icon, title, copy }) => (
            <div className={styles.step} key={title}>
              <Icon aria-hidden="true" size={18} />
              <div><b>{title}</b><p>{copy}</p></div>
            </div>
          ))}
        </div>

        <details className={styles.roles}>
          <summary>Who needs Authenticator?</summary>
          <p>Authenticator is required for every Office role: {roles.join(" · ")}.</p>
        </details>

        <div className={styles.security}>
          <div className={styles.securityHeading}>
            <LockKeyhole aria-hidden="true" size={17} />
            <b>Phone-side security boundary</b>
          </div>
          <p>
            Native secure storage · biometric unlock · no seed cloud sync ·
            protected activation exchange · no OTP clipboard export · automatic
            lock when the app backgrounds.
          </p>
        </div>

        {iosUrl ? (
          <a className={styles.iosLink} href={iosUrl} target="_blank" rel="noopener noreferrer">
            Approved iPhone installation channel
          </a>
        ) : (
          <p className={styles.iosNote}>
            iPhone installation requires an approved Apple distribution channel.
            The Google Play download is for Android devices.
          </p>
        )}

        <div className={styles.warning}>
          <Fingerprint aria-hidden="true" size={17} />
          <span>
            If a phone is lost or replaced, ask an authorised Office administrator
            to reset MFA. Never copy a previous device&apos;s secret.
          </span>
        </div>

        <p className={styles.hint}>
          Keep automatic date and time enabled. Authenticator generates
          one-time codes locally; it is not a password manager.
        </p>
        <Link className={styles.back} href="/office/login">Continue to Office sign in</Link>
      </div>
    </OfficeAuthLayout>
  );
}
