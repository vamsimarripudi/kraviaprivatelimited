import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Accordion, Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui";

const areas = [
  { title: "Privacy", copy: "How personal information collected through public forms is handled.", href: "/trust/privacy" },
  { title: "Data protection", copy: "Plain-language DPDP information and official references.", href: "/trust/data-protection" },
  { title: "Security", copy: "Verified security information and responsible reporting.", href: "/trust/security" },
  { title: "Responsible AI", copy: "Human oversight and appropriate automation.", href: "/trust/responsible-ai" },
] as const;

export function TrustOverview() {
  return <>
    <div className="trust-overview-grid">
      {areas.map((area) => <Card key={area.title} variant="trust" interactive><CardHeader><p className="eyebrow">TRUST AREA</p></CardHeader><CardTitle>{area.title}</CardTitle><CardDescription>{area.copy}</CardDescription><CardFooter><Link href={area.href} className="text-link">Read more <ArrowUpRight aria-hidden="true" /></Link></CardFooter></Card>)}
    </div>
    <section className="trust-questions" aria-labelledby="trust-questions-title"><p className="eyebrow">COMMON QUESTIONS</p><h2 id="trust-questions-title">Trust, stated plainly.</h2><Accordion label="Trust Center questions" entries={[
      { title: "Where can I make a privacy request?", content: <p>Use the secure request flow on Kravia’s Data Protection page. It routes a request to the restricted Trust and DPDP workflow rather than publishing it through a general form.</p> },
      { title: "Where do I report a security concern?", content: <p>Use the dedicated security reporting route. Do not include passwords, private keys, production data or harmful payloads in an initial report.</p> },
      { title: "Does Kravia publish certifications or compliance claims?", content: <p>Only evidence-backed, approved public statements may appear. The Trust Center deliberately distinguishes current information from items requiring final production review.</p> },
    ]} /></section>
  </>;
}
