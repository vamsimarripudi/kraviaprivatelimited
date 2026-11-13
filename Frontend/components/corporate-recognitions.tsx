import Image from "next/image";
import { BadgeCheck, Building2, ExternalLink } from "lucide-react";
import { nvidiaInceptionMembership } from "@/lib/corporate/program-memberships";
import { getPublicCorporateRegistrations } from "@/lib/corporate/public-registrations";

export async function CorporateRecognitions() {
  const recognitions = await getPublicCorporateRegistrations();
  if (!recognitions.length) return null;
  return <section className="corporate-recognitions" aria-labelledby="recognitions-title">
    <header><div><p className="eyebrow">COMPANY REGISTRATIONS & STARTUP PROGRAMS</p><h2 id="recognitions-title">Registrations and memberships.</h2><p>Approved corporate registrations and KRAVIA’s startup-program membership are shown separately. Certificates, approval letters and other internal evidence remain in the access-controlled Corporate Office.</p></div><BadgeCheck aria-hidden="true" /></header>
    <div className="recognition-grid">{recognitions.map((recognition) => <article key={recognition.reference}><Building2 aria-hidden="true" /><p>{recognition.authority}</p><h3>{recognition.title}</h3><code>{recognition.reference}</code><p>{recognition.description}</p><a href={recognition.href} target="_blank" rel="noopener noreferrer">Official verification portal <ExternalLink aria-hidden="true" size={14} /></a></article>)}</div>
    <article className="inception-recognition" aria-label="NVIDIA Inception program membership">
      <div>
        <p className="eyebrow">STARTUP PROGRAM MEMBERSHIP</p>
        <h3>{nvidiaInceptionMembership.program} · {nvidiaInceptionMembership.status}</h3>
        <p>{nvidiaInceptionMembership.description}</p>
        <a href={nvidiaInceptionMembership.url} target="_blank" rel="noopener noreferrer">
          About NVIDIA Inception <ExternalLink aria-hidden="true" size={14} />
        </a>
      </div>
      <Image src={nvidiaInceptionMembership.badge} alt="NVIDIA Inception Program member badge" width={501} height={217} unoptimized />
    </article>
    <p className="recognition-note">Company registrations establish corporate standing; startup-program membership is a separate status. {nvidiaInceptionMembership.disclaimer}</p>
  </section>;
}
