"use client";

import Link from "next/link";
import { ArrowDownRight, BriefcaseBusiness, HeartHandshake, LifeBuoy, Newspaper, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { EnquiryForm } from "@/components/enquiry-form";
import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { PublicFormPresentation } from "@/lib/admin/site-control-types";

const routes = [
  { category: "Product enquiry", label: "Products", copy: "Learn about a Kravia product or its fit for your organisation.", Icon: Sparkles },
  { category: "Partnership", label: "Partnerships", copy: "Explore a considered technology or distribution partnership.", Icon: HeartHandshake },
  { category: "Media / corporate enquiry", label: "Media & corporate", copy: "Request approved corporate context or media information.", Icon: Newspaper },
  { category: "Careers", label: "Careers", copy: "Ask about future opportunities with Kravia.", Icon: BriefcaseBusiness },
  { category: "Security", label: "Security", copy: "Report a security concern through the restricted Trust route.", Icon: ShieldAlert, href: "/trust/security-reporting" },
  { category: "General", label: "General", copy: "Send another question to the Kravia team.", Icon: LifeBuoy },
] as const;

export function ContactExperience({ presentation }: { presentation?: PublicFormPresentation | null }) {
  const [category, setCategory] = useState<string>("Business enquiry");
  return <section className="contact-experience shell" aria-labelledby="contact-router-title">
    <header className="contact-router-heading"><div><p className="eyebrow">CONTACT ROUTER</p><h2 id="contact-router-title">Start in the right place.</h2></div><p>Select a route and Kravia will carry that context into the enquiry form. Security concerns use a separate restricted workflow.</p></header>
    <div className="contact-router-grid">
      {routes.map((route) => { const { category: routeCategory, label, copy, Icon } = route; return "href" in route ? <Link className="contact-route-link" key={label} href={route.href}><Card variant="contact" interactive><CardHeader><Icon aria-hidden="true" /><Badge tone="warning">Restricted</Badge></CardHeader><CardTitle>{label}</CardTitle><CardDescription>{copy}</CardDescription><ArrowDownRight aria-hidden="true" /></Card></Link> : <button key={label} className="contact-route-button" type="button" aria-pressed={category === routeCategory} onClick={() => { setCategory(routeCategory); document.getElementById("enquiry-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }}><Card variant="contact" interactive><CardHeader><Icon aria-hidden="true" /><Badge tone={category === routeCategory ? "success" : "neutral"}>{category === routeCategory ? "Selected" : "Route"}</Badge></CardHeader><CardTitle>{label}</CardTitle><CardDescription>{copy}</CardDescription><ArrowDownRight aria-hidden="true" /></Card></button>; })}
    </div>
    <div id="enquiry-form" className="contact-form-panel"><div><p className="eyebrow">{category.toUpperCase()}</p><h2>{presentation?.title ?? "Tell us what you need."}</h2><p>{presentation?.intro ?? "The form is sent through Kravia’s controlled corporate intake. It will not create a public post or expose your details."}</p></div><EnquiryForm initialCategory={category} presentation={presentation} /></div>
  </section>;
}
