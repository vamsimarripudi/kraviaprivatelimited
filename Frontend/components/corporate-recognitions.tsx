import { BadgeCheck, Building2, ExternalLink } from "lucide-react";
import { getPublicCorporateRegistrations } from "@/lib/corporate/public-registrations";

export async function CorporateRecognitions() {
  const recognitions = await getPublicCorporateRegistrations();
  if (!recognitions.length) return null;
  return <section className="corporate-recognitions" aria-labelledby="recognitions-title">
    <header><div><p className="eyebrow">VERIFIED CORPORATE STATUS</p><h2 id="recognitions-title">Corporate registrations.</h2><p>Only approved registered identifiers are displayed. Supporting certificates, contact data and other corporate evidence remain in Kravia’s access-controlled Corporate Office.</p></div><BadgeCheck aria-hidden="true" /></header>
    <div className="recognition-grid">{recognitions.map((recognition) => <article key={recognition.reference}><Building2 aria-hidden="true" /><p>{recognition.authority}</p><h3>{recognition.title}</h3><code>{recognition.reference}</code><a href={recognition.href} target="_blank" rel="noreferrer">Official verification portal <ExternalLink aria-hidden="true" size={14} /></a></article>)}</div>
    <p className="recognition-note">These records confirm company registration or recognition only. They do not represent product certification, government endorsement or performance claims.</p>
  </section>;
}