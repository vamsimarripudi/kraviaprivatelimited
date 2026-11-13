import { render } from "@react-email/render";
import {
  KraviaEmailActionButton,
  KraviaEmailHero,
  KraviaEmailInfoCard,
  KraviaEmailShell,
  validateOfficeEmailUrl,
} from "./kravia-email-components.js";
import { OFFICE_LIFECYCLE_CATALOG } from "./office-lifecycle-catalog.js";
import { OFFICE_LIFECYCLE_COPY } from "./office-lifecycle-copy.js";

/**
 * An email-safe preview renderer only. A caller cannot send, enqueue, select
 * recipients, certify employment, approve payroll or issue a signature here.
 * The currently active security/OTP, invitation and reset templates remain
 * in their existing established backend flows.
 */
export type OfficeLifecyclePreview = {
  id: string;
  recipientName: string;
  payPeriod?: string;
  officeUrl?: string;
  eventReference?: string;
};

export type RenderedOfficeLifecyclePreview = {
  id: string;
  subject: string;
  html: string;
  text: string;
  previewOnly: true;
};

function safeText(value: string, label: string, max = 160): string {
  const next = value.trim();
  if (!next || next.length > max || /[\r\n\u0000-\u001f\u007f]/.test(next)) {
    throw new Error("Invalid Office lifecycle " + label);
  }
  return next;
}
export function availableOfficeLifecycleEventCodes(): string[] {
  return OFFICE_LIFECYCLE_CATALOG.map(entry=>entry.id);
}

/** Render only after an authorised event mapper has supplied real context.
 * The result never becomes a send request on its own. */
export async function renderOfficeLifecyclePreview(input: OfficeLifecyclePreview):
 Promise<RenderedOfficeLifecyclePreview> {
  const item = OFFICE_LIFECYCLE_CATALOG.find(entry=>entry.id===input.id);
  const textBody = OFFICE_LIFECYCLE_COPY[input.id];
  if (!item || !textBody) throw new Error("Unknown Office lifecycle event");
  const name = safeText(input.recipientName, "recipient name");
  const firstName = safeText(name.split(/\s+/)[0] || "", "recipient first name");
  const period = item.subject.includes("{{pay_period}}")
    ? safeText(input.payPeriod || "", "verified payroll period", 40) : undefined;
  const subject = item.subject.replaceAll("{{employee_first_name}}", firstName)
    .replaceAll("{{pay_period}}", period || "");
  if (/\{\{|\}\}|[\r\n]/.test(subject)) throw new Error("Unresolved Office lifecycle subject");
  const href = input.officeUrl ? validateOfficeEmailUrl(input.officeUrl) : undefined;
  const reference = input.eventReference ? safeText(input.eventReference, "event reference", 120) : undefined;
  const html = await render(
    <KraviaEmailShell preview={item.intent}>
      <KraviaEmailHero eyebrow={`KRAVIA OFFICE · ${item.id}`} title={subject}>
        <p style={{margin:"0 0 12px"}}>Hello {name},</p>
        <p style={{margin:"0 0 12px"}}>{textBody}</p>
      </KraviaEmailHero>
      {reference ? <KraviaEmailInfoCard title="Office event reference">
        <span>{reference}</span>
      </KraviaEmailInfoCard> : null}
      {href ? <KraviaEmailActionButton href={href}>Review in private KRAVIA Office</KraviaEmailActionButton> : null}
      <p style={{fontSize:12,lineHeight:"20px",color:"#51667d"}}>
        This notice reflects an Office event. It does not independently create
        a permission, legal appointment, salary payment, signed document or employment status.
        Sensitive records remain available only through authorised private access.
      </p>
    </KraviaEmailShell>,
  );
  if (/<script\b|javascript:/i.test(html)) throw new Error("Unsafe Office email markup");
  const text = [
    subject,
    "",
    `Hello ${name},`,
    "",
    textBody,
    ...(reference ? ["", "Office event reference: " + reference] : []),
    ...(href ? ["", "Review in private KRAVIA Office: " + href] : []),
    "",
    "This notice does not independently grant access, certify employment, prove a signed document or confirm a salary transfer.",
    "KRAVIA PRIVATE LIMITED",
  ].join("\n");
  return {id:input.id,subject,html,text,previewOnly:true};
}
