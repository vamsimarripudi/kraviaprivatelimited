import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { render } from "@react-email/render";
import type { ReactNode } from "react";

export const PLACEHOLDERS = {
  code: "@@KRAVIA_CODE@@",
  expiryMinutes: "@@KRAVIA_EXPIRY_MINUTES@@",
  name: "@@KRAVIA_NAME@@",
  senderEmail: "@@KRAVIA_SENDER_EMAIL@@",
  reference: "@@KRAVIA_REFERENCE@@",
  requestKind: "@@KRAVIA_REQUEST_KIND@@",
  nextStep: "@@KRAVIA_NEXT_STEP@@",
  message: "@@KRAVIA_MESSAGE@@",
  requestSubject: "@@KRAVIA_REQUEST_SUBJECT@@",
  organisation: "@@KRAVIA_ORGANISATION@@",
  deviceLabel: "@@KRAVIA_DEVICE_LABEL@@",
  sourceAddress: "@@KRAVIA_SOURCE_ADDRESS@@",
  approveUrl: "@@KRAVIA_APPROVE_URL@@",
  declineUrl: "@@KRAVIA_DECLINE_URL@@",
} as const;

export type KraviaEmailTemplateName =
  | "office_sign_in_code"
  | "public_request_received"
  | "public_request_update"
  | "public_intake_internal_notification"
  | "public_welcome"
  | "office_device_approval";

export type RenderedTemplate = {
  html: string;
  text: string;
};

const siteUrl = "https://www.kraviaprivatelimited.com";
const headerLockupUrl = `${siteUrl}/brand/kravia-header-lockup-v2.png`;

const palette = {
  ink: "#172331",
  sapphire: "#193B5B",
  steel: "#5D809D",
  pale: "#EFF3F7",
  white: "#FFFFFF",
  border: "#D7E1E9",
  mist: "#F8FAFC",
} as const;

/*
 * Gmail may recolour ordinary light-email surfaces in dark mode, but it does
 * not consistently recolour transparent image assets. Present the approved
 * lockup as white on a solid sapphire masthead, and keep the code and safety
 * copy in high-contrast HTML rather than relying on a dark transparent asset.
 */
const darkModeCss = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .kravia-email-body { background-color: #101923 !important; }
    .kravia-email-card { background-color: #172331 !important; border-color: #526b82 !important; }
    .kravia-email-title, .kravia-email-content { background-color: #172331 !important; }
    .kravia-email-heading, .kravia-email-paragraph { color: #FFFFFF !important; }
    .kravia-email-muted { color: #C9D9E8 !important; }
    .kravia-email-footer { background-color: #102A43 !important; border-color: #526B82 !important; }
  }
`;

function KraviaShell({
  preview,
  label,
  title,
  children,
}: {
  preview: string;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <meta content="light dark" name="color-scheme" />
        <meta content="light dark" name="supported-color-schemes" />
        <style>{darkModeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="kravia-email-body" style={styles.body}>
        <Container style={styles.container}>
          <Section className="kravia-email-card" style={styles.card}>
            <Section style={styles.topRule} />
            <Section style={styles.masthead}>
              <Img
                alt="KRAVIA Private Limited"
                height="52"
                src={headerLockupUrl}
                style={styles.lockup}
                width="156"
              />
              <Text style={styles.label}>{label}</Text>
            </Section>
            <Section className="kravia-email-title" style={styles.titleBlock}>
              <Heading as="h1" className="kravia-email-heading" style={styles.heading}>{title}</Heading>
            </Section>
            <Section className="kravia-email-content" style={styles.content}>{children}</Section>
            <Section className="kravia-email-footer" style={styles.footer}>
              <Text style={styles.footerEyebrow}>ACCOUNT SAFETY</Text>
              <Text style={styles.footerCopy}>
                For your safety, KRAVIA will never ask for your password,
                one-time code, private key, or card PIN by email.
              </Text>
              <Text style={styles.footerLinks}>
                <Link href={`${siteUrl}/trust/privacy`} style={styles.link}>Privacy</Link>
                {"  ·  "}
                <Link href={`${siteUrl}/legal`} style={styles.link}>Legal notices and terms</Link>
                {"  ·  "}
                <Link href={`${siteUrl}/contact`} style={styles.link}>Contact</Link>
              </Text>
              <Text style={styles.copyright}>© KRAVIA PRIVATE LIMITED. All rights reserved.</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function SignInCodeEmail() {
  return (
    <KraviaShell
      preview="Your KRAVIA Office verification code"
      label="KRAVIA OFFICE"
      title="Confirm your sign-in"
    >
      <Text className="kravia-email-paragraph" style={styles.paragraph}>Use this one-time code to finish signing in to KRAVIA Office.</Text>
      <Section style={styles.codePanel}>
        <Text style={styles.codeLabel}>ONE-TIME SIGN-IN CODE</Text>
        <Text aria-label="Your verification code" style={styles.code}>{PLACEHOLDERS.code}</Text>
      </Section>
      <Text className="kravia-email-paragraph" style={styles.paragraph}>
        This code expires in {PLACEHOLDERS.expiryMinutes} minutes and works only once. Do not share it with anyone, including KRAVIA staff.
      </Text>
      <Text className="kravia-email-muted" style={styles.muted}>Didn’t try to sign in? You can safely ignore this email.</Text>
    </KraviaShell>
  );
}

function DeviceApprovalEmail() {
  return (
    <KraviaShell
      preview="Review a new KRAVIA Office device sign-in"
      label="KRAVIA OFFICE SECURITY"
      title="Approve this new device?"
    >
      <Text className="kravia-email-paragraph" style={styles.paragraph}>
        A new KRAVIA sign-in device completed your password and registered-email checks. It cannot access your account until you make a decision below.
      </Text>
      <Section style={styles.referenceBox}>
        <Text style={styles.referenceLabel}>DEVICE</Text>
        <Text style={styles.referenceValue}>{PLACEHOLDERS.deviceLabel}</Text>
        <Text style={styles.referenceLabel}>ADDRESS OBSERVED BY KRAVIA</Text>
        <Text style={styles.referenceValue}>{PLACEHOLDERS.sourceAddress}</Text>
      </Section>
      <Text className="kravia-email-paragraph" style={styles.paragraph}>
        Trust only if this was you. Trusting this request locks your KRAVIA account to the original device and securely signs out any previously trusted device. This email link never signs in the browser or phone that opens it.
      </Text>
      <Section style={styles.buttonRow}>
        <Link href={PLACEHOLDERS.approveUrl} style={styles.primaryButton}>Trust this device</Link>
      </Section>
      <Section style={styles.buttonRow}>
        <Link href={PLACEHOLDERS.declineUrl} style={styles.secondaryButton}>Ignore and sign out</Link>
      </Section>
      <Text className="kravia-email-muted" style={styles.muted}>
        New to KRAVIA Authenticator? Install only the company-provided app, open it, enter your registered corporate email and password, type the one-time code sent to this mailbox, then return here to trust the exact device. If you did not start this sign-in, choose ignore. The request is immediately blocked and the device is signed out.
      </Text>
    </KraviaShell>
  );
}

function PublicRequestReceivedEmail() {
  return (
    <KraviaShell
      preview="KRAVIA has received your request"
      label="KRAVIA REQUESTS"
      title="Your request is with our team."
    >
      <Text style={styles.paragraph}>Hello {PLACEHOLDERS.name},</Text>
      <Text style={styles.paragraph}>
        We received your {PLACEHOLDERS.requestKind}. {PLACEHOLDERS.nextStep}
      </Text>
      <Section style={styles.referenceBox}>
        <Text style={styles.referenceLabel}>REFERENCE</Text>
        <Text style={styles.referenceValue}>{PLACEHOLDERS.reference}</Text>
      </Section>
    </KraviaShell>
  );
}

function PublicRequestUpdateEmail() {
  return (
    <KraviaShell
      preview="An update from KRAVIA"
      label="KRAVIA REQUESTS"
      title="An update from our team."
    >
      <Text style={styles.paragraph}>Hello {PLACEHOLDERS.name},</Text>
      <Section style={styles.referenceBox}>
        <Text style={styles.referenceLabel}>REFERENCE</Text>
        <Text style={styles.referenceValue}>{PLACEHOLDERS.reference}</Text>
      </Section>
      <Text style={styles.message}>{PLACEHOLDERS.message}</Text>
    </KraviaShell>
  );
}

function PublicIntakeInternalNotificationEmail() {
  return (
    <KraviaShell
      preview="A new KRAVIA public request needs review"
      label="KRAVIA INTAKE"
      title="A new public request needs review."
    >
      <Text style={styles.paragraph}>
        A requester has submitted a {PLACEHOLDERS.requestKind} through the KRAVIA website.
      </Text>
      <Section style={styles.referenceBox}>
        <Text style={styles.referenceLabel}>REFERENCE</Text>
        <Text style={styles.referenceValue}>{PLACEHOLDERS.reference}</Text>
      </Section>
      <Section style={styles.intakeDetails}>
        <Text style={styles.intakeLabel}>FROM</Text>
        <Text style={styles.intakeValue}>{PLACEHOLDERS.name}</Text>
        <Text style={styles.intakeEmail}>{PLACEHOLDERS.senderEmail}</Text>
        <Text style={styles.intakeLabel}>SUBJECT</Text>
        <Text style={styles.intakeValue}>{PLACEHOLDERS.requestSubject}</Text>
        <Text style={styles.intakeLabel}>ORGANISATION</Text>
        <Text style={styles.intakeValue}>{PLACEHOLDERS.organisation}</Text>
      </Section>
      <Text style={styles.muted}>
        Reply to this email to contact the requester directly. The full request remains in the appropriate KRAVIA Office intake queue.
      </Text>
    </KraviaShell>
  );
}

function WelcomeEmail() {
  return (
    <KraviaShell
      preview="A warm welcome from KRAVIA"
      label="KRAVIA CONNECTIONS"
      title="Welcome to KRAVIA"
    >
      <Text style={styles.welcomeQuote}>“You belong here — wherever you are building what matters.”</Text>
      <Text style={styles.paragraph}>Hello {PLACEHOLDERS.name},</Text>
      <Text style={styles.paragraph}>
        This is more than a message in your inbox. It is a warm welcome and the beginning of a connection built on curiosity, trust, and meaningful progress.
      </Text>
      <Text style={styles.paragraph}>
        At KRAVIA, we make room for people who care about what they are building. When you are ready, our team is here to listen, guide, and help you find the next right step.
      </Text>
      <Text style={styles.paragraph}>
        We wish you clarity in every decision, confidence in every new beginning, and opportunities that feel worth pursuing. We are genuinely glad you are here.
      </Text>
      <Text style={styles.welcomeClosing}>With warm wishes,<br />KRAVIA</Text>
    </KraviaShell>
  );
}

const templates: Record<KraviaEmailTemplateName, () => ReactNode> = {
  office_sign_in_code: SignInCodeEmail,
  office_device_approval: DeviceApprovalEmail,
  public_request_received: PublicRequestReceivedEmail,
  public_request_update: PublicRequestUpdateEmail,
  public_intake_internal_notification: PublicIntakeInternalNotificationEmail,
  public_welcome: WelcomeEmail,
};

export async function renderTemplateManifest(): Promise<Record<KraviaEmailTemplateName, RenderedTemplate>> {
  const rendered = await Promise.all(
    (Object.entries(templates) as Array<[KraviaEmailTemplateName, () => ReactNode]>).map(async ([name, Template]) => [
      name,
      {
        html: await render(<Template />),
        text: await render(<Template />, { plainText: true }),
      },
    ] as const),
  );
  return Object.fromEntries(rendered) as Record<KraviaEmailTemplateName, RenderedTemplate>;
}

const styles = {
  body: { margin: "0", backgroundColor: palette.pale, color: palette.ink, fontFamily: "Arial, 'Segoe UI', sans-serif" },
  container: { width: "100%", maxWidth: "640px", margin: "0 auto", padding: "40px 18px" },
  card: { backgroundColor: palette.white, border: `1px solid ${palette.border}` },
  topRule: { margin: "0", height: "5px", backgroundColor: palette.sapphire, fontSize: "5px", lineHeight: "5px" },
  masthead: { padding: "24px 32px 22px", backgroundColor: palette.sapphire },
  lockup: { display: "block", height: "52px", width: "156px", maxWidth: "100%", filter: "brightness(0) invert(1)", WebkitFilter: "brightness(0) invert(1)" },
  label: { margin: "22px 0 0", color: "#D9E8F7", fontSize: "10px", fontWeight: "700", letterSpacing: "1.7px", lineHeight: "15px" },
  titleBlock: { padding: "24px 32px 25px", backgroundColor: palette.white, borderTop: `1px solid ${palette.border}`, borderBottom: `1px solid ${palette.border}` },
  heading: { margin: "0", color: palette.ink, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "30px", fontWeight: "400", letterSpacing: "-0.45px", lineHeight: "38px" },
  content: { padding: "30px 32px 8px" },
  paragraph: { margin: "0 0 20px", color: palette.ink, fontSize: "16px", lineHeight: "26px" },
  welcomeQuote: { margin: "0 0 24px", color: palette.sapphire, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "20px", fontStyle: "italic", lineHeight: "30px" },
  welcomeClosing: { margin: "4px 0 20px", color: palette.sapphire, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "17px", lineHeight: "26px" },
  codePanel: { margin: "4px 0 26px", padding: "19px 20px 21px", backgroundColor: palette.sapphire, border: "1px solid #102A43", textAlign: "center" as const },
  codeLabel: { margin: "0 0 9px", color: "#D9E8F7", fontSize: "10px", fontWeight: "700", letterSpacing: "1.8px", lineHeight: "15px" },
  code: { margin: "0", color: palette.white, fontSize: "32px", fontWeight: "700", letterSpacing: "9px", lineHeight: "40px", textAlign: "center" as const },
  buttonRow: { margin: "0 0 14px", textAlign: "center" as const },
  primaryButton: { display: "block", padding: "15px 18px", backgroundColor: palette.sapphire, color: palette.white, fontSize: "15px", fontWeight: "700", lineHeight: "20px", textAlign: "center" as const, textDecoration: "none" },
  secondaryButton: { display: "block", padding: "14px 18px", backgroundColor: palette.white, border: `1px solid ${palette.sapphire}`, color: palette.sapphire, fontSize: "15px", fontWeight: "700", lineHeight: "20px", textAlign: "center" as const, textDecoration: "none" },
  muted: { margin: "0 0 24px", color: palette.steel, fontSize: "13px", lineHeight: "21px" },
  referenceBox: { margin: "4px 0 26px", padding: "18px 20px", backgroundColor: palette.mist, border: `1px solid ${palette.border}`, borderLeft: `4px solid ${palette.sapphire}` },
  referenceLabel: { margin: "0 0 6px", color: palette.steel, fontSize: "10px", fontWeight: "700", letterSpacing: "1.6px", lineHeight: "15px" },
  referenceValue: { margin: "0", color: palette.sapphire, fontSize: "16px", fontWeight: "700", letterSpacing: "0.55px", lineHeight: "25px" },
  intakeDetails: { margin: "4px 0 26px", padding: "20px", backgroundColor: palette.white, border: `1px solid ${palette.border}` },
  intakeLabel: { margin: "0 0 4px", color: palette.steel, fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", lineHeight: "15px" },
  intakeValue: { margin: "0 0 12px", color: palette.ink, fontSize: "15px", lineHeight: "23px" },
  intakeEmail: { margin: "0 0 18px", color: palette.sapphire, fontSize: "15px", fontWeight: "700", lineHeight: "23px" },
  message: { margin: "0 0 26px", color: palette.ink, fontSize: "16px", lineHeight: "26px", whiteSpace: "pre-line" as const },
  footer: { padding: "24px 32px 28px", backgroundColor: palette.sapphire, borderTop: "1px solid #102A43" },
  footerEyebrow: { margin: "0 0 8px", color: "#D9E8F7", fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", lineHeight: "15px" },
  footerCopy: { margin: "0 0 16px", color: palette.white, fontSize: "12px", lineHeight: "19px" },
  footerLinks: { margin: "0 0 14px", color: "#D9E8F7", fontSize: "12px", lineHeight: "19px" },
  link: { color: palette.white, textDecoration: "underline" },
  copyright: { margin: "0", color: "#D9E8F7", fontSize: "11px", lineHeight: "16px" },
};
