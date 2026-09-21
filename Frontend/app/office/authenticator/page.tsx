import type { Metadata } from "next";
import Link from "next/link";
import { OfficeAuthLayout } from "@/components/office-auth-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "KRAVIA Authenticator | Office MFA",
  description: "Install and enroll KRAVIA Authenticator for mandatory KRAVIA Office multi-factor authentication.",
  alternates: { canonical: "/office/authenticator" },
  robots: { index: false, follow: false, nocache: true },
};

const roles = ["Owner", "Director", "Admin", "Member", "Finance", "CA", "CS", "Legal", "HR", "Operations", "Auditor", "Product Admin"];

export default function KraviaAuthenticatorPage() {
  const androidUrl = process.env.KRAVIA_AUTHENTICATOR_ANDROID_URL?.trim();
  const iosUrl = process.env.KRAVIA_AUTHENTICATOR_IOS_URL?.trim();

  return (
    <OfficeAuthLayout
      title="KRAVIA Authenticator"
      description="The required offline second factor for KRAVIA Office and Finance."
      footerHref="/office/login"
      footerLabel="Back to Office sign in"
    >
      <div style={{ display: "grid", gap: 16, fontFamily: 'Inter,"Segoe UI",sans-serif' }}>
        <p style={{ margin: 0, color: "#2c6a51", fontWeight: 800, fontSize: 11, letterSpacing: ".16em" }}>MANDATORY FOR EVERY OFFICE ROLE</p>
        <h2 style={{ margin: 0, color: "#10241c", fontSize: 30, letterSpacing: "-.035em" }}>Install before your first Office login</h2>
        <p style={{ margin: 0, color: "#66716b", lineHeight: 1.65, fontSize: 14 }}>
          KRAVIA Authenticator generates the six-digit login code locally on your phone every 30 seconds. It does not store your Office password and it does not need a network connection to generate codes.
        </p>

        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #d9e6dc", background: "#f1f7f3", color: "#365b49", fontSize: 12, lineHeight: 1.55 }}>
          Required roles: {roles.join(" · ")}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {androidUrl ? <a href={androidUrl} rel="noreferrer" style={{ height: 48, borderRadius: 12, display: "grid", placeItems: "center", textDecoration: "none", background: "#123d2e", color: "#fff", fontWeight: 800 }}>Install Android app</a> : <div style={{ padding: 13, borderRadius: 12, background: "#f5f3ee", color: "#6d6659", fontSize: 12 }}>Android signed-build distribution is not configured yet. KRAVIA IT must provide the approved APK/Play link.</div>}
          {iosUrl ? <a href={iosUrl} rel="noreferrer" style={{ height: 48, borderRadius: 12, display: "grid", placeItems: "center", textDecoration: "none", border: "1px solid #cad5cf", color: "#123d2e", fontWeight: 800 }}>Install iPhone app</a> : <div style={{ padding: 13, borderRadius: 12, background: "#f5f3ee", color: "#6d6659", fontSize: 12 }}>iPhone signed-build distribution is not configured yet. KRAVIA IT must provide the approved TestFlight/App Store link.</div>}
        </div>

        <div style={{ display: "grid", gap: 8, padding: 14, borderRadius: 14, border: "1px solid #e1e5e2", background: "#fff" }}>
          <b style={{ color: "#1a2720" }}>Enrollment</b>
          <span style={{ color: "#65716a", fontSize: 12, lineHeight: 1.55 }}>1. Install KRAVIA Authenticator.</span>
          <span style={{ color: "#65716a", fontSize: 12, lineHeight: 1.55 }}>2. Sign in to Office with your corporate email and password.</span>
          <span style={{ color: "#65716a", fontSize: 12, lineHeight: 1.55 }}>3. Scan the KRAVIA Office QR shown after password verification.</span>
          <span style={{ color: "#65716a", fontSize: 12, lineHeight: 1.55 }}>4. Enter the current six-digit code to complete AAL2 verification.</span>
        </div>

        <p style={{ margin: 0, color: "#7b817e", fontSize: 11, lineHeight: 1.55 }}>
          Keep automatic date and time enabled. If the phone is lost or replaced, an authorised Office administrator must reset MFA before the replacement device can enroll.
        </p>

        <Link href="/office/login" style={{ color: "#225c46", fontWeight: 800, textDecoration: "none", textAlign: "center" }}>Continue to Office sign in</Link>
      </div>
    </OfficeAuthLayout>
  );
}
