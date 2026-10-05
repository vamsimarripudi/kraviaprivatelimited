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
} as const;

export type KraviaEmailTemplateName =
  | "office_sign_in_code"
  | "public_request_received"
  | "public_request_update"
  | "public_intake_internal_notification"
  | "public_welcome";

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
  navyMist: "#E7EEF4",
} as const;

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
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
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
            <Section style={styles.titleBlock}>
              <Heading as="h1" style={styles.heading}>{title}</Heading>
            </Section>
            <Section style={styles.content}>{children}</Section>
            <Section style={styles.footer}>
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
      <Text style={styles.paragraph}>Use this one-time code to finish signing in to KRAVIA Office.</Text>
      <Text aria-label="Your verification code" style={styles.code}>{PLACEHOLDERS.code}</Text>
      <Text style={styles.paragraph}>
        This code expires in {PLACEHOLDERS.expiryMinutes} minutes and works only once. Do not share it with anyone, including KRAVIA staff.
      </Text>
      <Text style={styles.muted}>Didn’t try to sign in? You can safely ignore this email.</Text>
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
  masthead: { padding: "26px 32px 22px", backgroundColor: palette.white },
  lockup: { display: "block", height: "52px", width: "156px", maxWidth: "100%" },
  label: { margin: "22px 0 0", color: palette.steel, fontSize: "10px", fontWeight: "700", letterSpacing: "1.7px", lineHeight: "15px" },
  titleBlock: { padding: "22px 32px 24px", backgroundColor: palette.mist, borderTop: `1px solid ${palette.border}`, borderBottom: `1px solid ${palette.border}` },
  heading: { margin: "0", color: palette.sapphire, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "30px", fontWeight: "400", letterSpacing: "-0.45px", lineHeight: "38px" },
  content: { padding: "30px 32px 8px" },
  paragraph: { margin: "0 0 20px", color: palette.ink, fontSize: "16px", lineHeight: "26px" },
  welcomeQuote: { margin: "0 0 24px", color: palette.sapphire, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "20px", fontStyle: "italic", lineHeight: "30px" },
  welcomeClosing: { margin: "4px 0 20px", color: palette.sapphire, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "17px", lineHeight: "26px" },
  code: { margin: "4px 0 26px", padding: "20px", backgroundColor: palette.mist, border: `1px solid ${palette.border}`, borderTop: `3px solid ${palette.sapphire}`, color: palette.sapphire, fontSize: "31px", fontWeight: "700", letterSpacing: "9px", lineHeight: "38px", textAlign: "center" as const },
  muted: { margin: "0 0 24px", color: palette.steel, fontSize: "13px", lineHeight: "21px" },
  referenceBox: { margin: "4px 0 26px", padding: "18px 20px", backgroundColor: palette.mist, border: `1px solid ${palette.border}`, borderLeft: `4px solid ${palette.sapphire}` },
  referenceLabel: { margin: "0 0 6px", color: palette.steel, fontSize: "10px", fontWeight: "700", letterSpacing: "1.6px", lineHeight: "15px" },
  referenceValue: { margin: "0", color: palette.sapphire, fontSize: "16px", fontWeight: "700", letterSpacing: "0.55px", lineHeight: "25px" },
  intakeDetails: { margin: "4px 0 26px", padding: "20px", backgroundColor: palette.white, border: `1px solid ${palette.border}` },
  intakeLabel: { margin: "0 0 4px", color: palette.steel, fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", lineHeight: "15px" },
  intakeValue: { margin: "0 0 12px", color: palette.ink, fontSize: "15px", lineHeight: "23px" },
  intakeEmail: { margin: "0 0 18px", color: palette.sapphire, fontSize: "15px", fontWeight: "700", lineHeight: "23px" },
  message: { margin: "0 0 26px", color: palette.ink, fontSize: "16px", lineHeight: "26px", whiteSpace: "pre-line" as const },
  footer: { padding: "24px 32px 28px", backgroundColor: palette.navyMist, borderTop: `1px solid ${palette.border}` },
  footerEyebrow: { margin: "0 0 8px", color: palette.sapphire, fontSize: "10px", fontWeight: "700", letterSpacing: "1.5px", lineHeight: "15px" },
  footerCopy: { margin: "0 0 16px", color: palette.ink, fontSize: "12px", lineHeight: "19px" },
  footerLinks: { margin: "0 0 14px", color: palette.steel, fontSize: "12px", lineHeight: "19px" },
  link: { color: palette.sapphire, textDecoration: "underline" },
  copyright: { margin: "0", color: palette.steel, fontSize: "11px", lineHeight: "16px" },
};
