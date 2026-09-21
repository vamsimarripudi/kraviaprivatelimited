import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { OfficeAuthLayout } from "@/components/office-auth-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "KRAVIA Authenticator | Office MFA",
  description: "Install and enroll KRAVIA Authenticator for mandatory KRAVIA Office multi-factor authentication.",
  alternates: { canonical: "/office/authenticator" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const roles = ["Owner", "Director", "Admin", "Member", "Finance", "CA", "CS", "Legal", "HR", "Operations", "Auditor", "Product Admin"];

function secureUrl(value: string | undefined) {
  const candidate = value?.trim();
  return candidate?.startsWith("https://") ? candidate : undefined;
}

export default function KraviaAuthenticatorPage() {
  const androidUrl = secureUrl(process.env.KRAVIA_AUTHENTICATOR_ANDROID_URL);
  const iosUrl = secureUrl(process.env.KRAVIA_AUTHENTICATOR_IOS_URL);

  return (
    <OfficeAuthLayout
      eyebrow="MANDATORY SECOND FACTOR"
      title="KRAVIA Authenticator"
      description="The required offline second factor for every KRAVIA Office and Finance role."
      footerHref="/office/login"
      footerLabel="Back to Office sign in"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: 'Inter,"Segoe UI",sans-serif' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: "#e9f1eb", color: "#0d5a3f", border: "1px solid #d9e6dc" }}>
          <ShieldCheck size={21} />
        </div>

        <div>
          <p style={{ margin: "0 0 5px", fontSize: 10, letterSpacing: ".16em", fontWeight: 800, color: "#8a6a30" }}>MANDATORY FOR EVERY OFFICE ROLE</p>
          <h2 style={{ margin: 0, fontSize: 29, letterSpacing: "-.035em", color: "#10241c" }}>Install and enroll your phone</h2>
        </div>

        <p style={{ margin: 0, color: "#64706a", fontSize: 13, lineHeight: 1.65 }}>
          KRAVIA Authenticator generates the current six-digit login code entirely on your phone every 30 seconds. It does not store your Office password, does not require an internet connection to generate codes, and does not synchronize the authenticator seed to a cloud service.
        </p>

        <div style={{ padding: 13, borderRadius: 13, border: "1px solid #d9e6dc", background: "#f1f7f3", color: "#365b49", fontSize: 11, lineHeight: 1.6 }}>
          Mandatory roles: {roles.join(" · ")}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {[
            [Smartphone, "1 · Prepare the phone", "Use a company-approved phone with a device passcode and strong fingerprint, Touch ID or Face ID enabled."],
            [KeyRound, "2 · Sign in with your password", "Password verification creates only an AAL1 session. It does not open the protected workspace."],
            [Camera, "3 · Scan the KRAVIA QR", "On first enrollment, scan the QR shown by Office. The app rejects non-KRAVIA issuers and unsupported OTP profiles."],
            [ShieldCheck, "4 · Verify six digits", "Enter the current code back into Office. Successful TOTP verification promotes the session to AAL2."],
          ].map(([Icon, title, copy]) => {
            const StepIcon = Icon as typeof Smartphone;
            return <div key={String(title)} style={{ display: "flex", gap: 11, padding: 13, border: "1px solid #e0e6e2", borderRadius: 13, background: "#fff" }}>
              <StepIcon size={18} color="#276047" style={{ flexShrink: 0, marginTop: 2 }} />
              <span><b style={{ display: "block", color: "#1b2c24", fontSize: 12 }}>{String(title)}</b><small style={{ display: "block", marginTop: 3, color: "#6d7671", fontSize: 11, lineHeight: 1.55 }}>{String(copy)}</small></span>
            </div>;
          })}
        </div>

        <div style={{ display: "grid", gap: 8, padding: 14, borderRadius: 14, background: "#edf5ef", border: "1px solid #d4e4d8" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#285440" }}><LockKeyhole size={17} /><b style={{ fontSize: 12 }}>Phone-side security boundary</b></div>
          <p style={{ margin: 0, color: "#476155", fontSize: 11, lineHeight: 1.6 }}>
            Native secure storage · strong local biometric unlock · no cloud sync · Android network permission blocked · no OTP clipboard export · screen-capture protection · automatic lock and in-memory seed removal when the app backgrounds.
          </p>
        </div>

        <div style={{ display: "grid", gap: 9 }}>
          <b style={{ color: "#24342d", fontSize: 12 }}>Approved installation channels</b>
          {androidUrl ? (
            <a href={androidUrl} rel="noreferrer" style={{ minHeight: 48, borderRadius: 13, display: "grid", placeItems: "center", textDecoration: "none", background: "#123d2e", color: "#fff", fontWeight: 800, fontSize: 13 }}>Install Android app</a>
          ) : (
            <div style={{ padding: 12, borderRadius: 12, background: "#f6f1e8", border: "1px solid #eadfc9", color: "#735a2e", fontSize: 11, lineHeight: 1.55 }}>
              Android release-smoke APK is produced by KRAVIA CI for controlled testing. No public APK URL is exposed until a persistent KRAVIA-signed distribution channel is approved.
            </div>
          )}
          {iosUrl ? (
            <a href={iosUrl} rel="noreferrer" style={{ minHeight: 48, borderRadius: 13, display: "grid", placeItems: "center", textDecoration: "none", border: "1px solid #cad5cf", color: "#123d2e", fontWeight: 800, fontSize: 13 }}>Install iPhone app</a>
          ) : (
            <div style={{ padding: 12, borderRadius: 12, background: "#f5f3ee", border: "1px solid #e7e0d5", color: "#6d6659", fontSize: 11, lineHeight: 1.55 }}>
              iPhone source and JS bundle are validated. Employee installation waits for approved Apple signing and a TestFlight/App Store or company MDM channel.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: 12, borderRadius: 12, background: "#fff6f4", border: "1px solid #eed8d3", color: "#6f453e", fontSize: 10.5, lineHeight: 1.55 }}>
          <Fingerprint size={17} style={{ flexShrink: 0 }} />
          <span>If a phone is lost, replaced or reinstalled, do not copy the old seed. An authorised Office administrator resets MFA and the replacement phone enrolls a newly generated seed.</span>
        </div>

        <p style={{ margin: 0, color: "#7b817e", fontSize: 10.5, lineHeight: 1.55 }}>Keep automatic date and time enabled. KRAVIA Authenticator is an offline TOTP vault, not an Office password manager or approval app.</p>
        <Link href="/office/login" style={{ color: "#225c46", fontWeight: 800, textDecoration: "none", textAlign: "center", fontSize: 12 }}>Continue to Office sign in</Link>
      </div>
    </OfficeAuthLayout>
  );
}
