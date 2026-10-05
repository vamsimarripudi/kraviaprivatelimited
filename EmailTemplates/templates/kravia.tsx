import {
  Body,
  Container,
  Head,
  Heading,
  Html,
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
  reference: "@@KRAVIA_REFERENCE@@",
  requestKind: "@@KRAVIA_REQUEST_KIND@@",
  nextStep: "@@KRAVIA_NEXT_STEP@@",
  message: "@@KRAVIA_MESSAGE@@",
} as const;

export type KraviaEmailTemplateName =
  | "office_sign_in_code"
  | "public_request_received"
  | "public_request_update"
  | "public_welcome";

export type RenderedTemplate = {
  html: string;
  text: string;
};

const siteUrl = "https://www.kraviaprivatelimited.com";

const palette = {
  ink: "#172331",
  sapphire: "#193B5B",
  steel: "#5D809D",
  pale: "#EFF3F7",
  white: "#FFFFFF",
  border: "#D7E1E9",
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
            <Section style={styles.header}>
              <Text style={styles.monogram}>K</Text>
              <Text style={styles.brand}>KRAVIA PRIVATE LIMITED</Text>
              <Text style={styles.label}>{label}</Text>
              <Heading as="h1" style={styles.heading}>{title}</Heading>
            </Section>
            <Section style={styles.content}>{children}</Section>
            <Section style={styles.footer}>
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
      title="Your request is with us."
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

function WelcomeEmail() {
  return (
    <KraviaShell
      preview="Welcome to KRAVIA"
      label="KRAVIA PRIVATE LIMITED"
      title="Welcome to KRAVIA."
    >
      <Text style={styles.paragraph}>Hello {PLACEHOLDERS.name},</Text>
      <Text style={styles.paragraph}>
        We are glad to be connected. When you are ready, our team is here to help you explore KRAVIA.
      </Text>
    </KraviaShell>
  );
}

const templates: Record<KraviaEmailTemplateName, () => ReactNode> = {
  office_sign_in_code: SignInCodeEmail,
  public_request_received: PublicRequestReceivedEmail,
  public_request_update: PublicRequestUpdateEmail,
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
  container: { width: "100%", maxWidth: "620px", margin: "0 auto", padding: "32px 18px" },
  card: { backgroundColor: palette.white, border: `1px solid ${palette.border}` },
  header: { backgroundColor: palette.sapphire, color: palette.white, padding: "28px" },
  monogram: { margin: "0 0 10px", color: palette.white, fontSize: "32px", fontWeight: "700", letterSpacing: "-2px", lineHeight: "32px" },
  brand: { margin: "0", color: palette.white, fontSize: "12px", fontWeight: "700", letterSpacing: "1.4px", lineHeight: "18px" },
  label: { margin: "18px 0 0", color: "#D6E4EE", fontSize: "11px", fontWeight: "700", letterSpacing: "1.4px", lineHeight: "16px" },
  heading: { margin: "8px 0 0", color: palette.white, fontSize: "26px", fontWeight: "600", letterSpacing: "-0.3px", lineHeight: "34px" },
  content: { padding: "30px 28px 8px" },
  paragraph: { margin: "0 0 20px", color: palette.ink, fontSize: "16px", lineHeight: "25px" },
  code: { margin: "0 0 24px", padding: "18px", backgroundColor: palette.pale, border: `1px solid ${palette.border}`, color: palette.sapphire, fontSize: "30px", fontWeight: "700", letterSpacing: "8px", lineHeight: "36px", textAlign: "center" as const },
  muted: { margin: "0 0 20px", color: palette.steel, fontSize: "13px", lineHeight: "20px" },
  referenceBox: { margin: "0 0 24px", padding: "16px", backgroundColor: palette.pale, borderLeft: `3px solid ${palette.steel}` },
  referenceLabel: { margin: "0 0 4px", color: palette.steel, fontSize: "11px", fontWeight: "700", letterSpacing: "1.2px", lineHeight: "16px" },
  referenceValue: { margin: "0", color: palette.sapphire, fontSize: "16px", fontWeight: "700", letterSpacing: "0.4px", lineHeight: "24px" },
  message: { margin: "0 0 24px", color: palette.ink, fontSize: "16px", lineHeight: "25px", whiteSpace: "pre-line" as const },
  footer: { borderTop: `1px solid ${palette.border}`, padding: "20px 28px 24px" },
  footerCopy: { margin: "0 0 12px", color: palette.steel, fontSize: "12px", lineHeight: "18px" },
  footerLinks: { margin: "0 0 12px", color: palette.steel, fontSize: "12px", lineHeight: "18px" },
  link: { color: palette.sapphire, textDecoration: "underline" },
  copyright: { margin: "0", color: palette.steel, fontSize: "11px", lineHeight: "16px" },
};
