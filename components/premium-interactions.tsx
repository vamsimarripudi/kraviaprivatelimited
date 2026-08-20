"use client";

import Link from "next/link";
import { BrainCircuit, Boxes, Check, Link2, Network, type LucideIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useState } from "react";

type MagneticLinkProps = { href: string; className: string; children: ReactNode };

export function MagneticLink({ href, className, children }: MagneticLinkProps) {
  const reduceMotion = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  function handleMove(event: PointerEvent<HTMLAnchorElement>) {
    if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setOffset({ x: (event.clientX - bounds.left - bounds.width / 2) * 0.11, y: (event.clientY - bounds.top - bounds.height / 2) * 0.11 });
  }
  return <Link href={href} className={className} onPointerMove={handleMove} onPointerLeave={() => setOffset({ x: 0, y: 0 })} style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}>{children}</Link>;
}

export function SiteScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maximum > 0 ? Math.min(100, Math.max(0, (window.scrollY / maximum) * 100)) : 0);
    };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <div className="site-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>;
}

type Capability = { label: string; title: string; copy: string; detail: string; Icon: LucideIcon };
const capabilities: Capability[] = [
  { label: "01", title: "Software products", copy: "Focused products shaped around real organisational workflows.", detail: "Product work is made legible through clear interfaces, purposeful features and careful release decisions.", Icon: Boxes },
  { label: "02", title: "Intelligent systems", copy: "Applied intelligence that supports people, context and better decisions.", detail: "Automation is designed with appropriate human judgement, understandable boundaries and responsible use in mind.", Icon: BrainCircuit },
  { label: "03", title: "Digital infrastructure", copy: "Connected foundations for systems that need to remain dependable.", detail: "Integration, data and operational foundations are considered as part of the product—not an afterthought.", Icon: Network },
];

export function CapabilityExplorer() {
  const [selected, setSelected] = useState(0);
  const item = capabilities[selected];
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? capabilities.length - 1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % capabilities.length : (index - 1 + capabilities.length) % capabilities.length;
    setSelected(next); document.getElementById(`capability-tab-${next}`)?.focus();
  }
  return <section className="capability-explorer shell" aria-labelledby="capability-title"><div className="capability-intro"><p className="eyebrow">02A / CAPABILITY MAP</p><h2 id="capability-title">Explore the<br /><em>connected work.</em></h2><p>Choose an area to see how Kravia brings product, systems and infrastructure together.</p></div><div className="capability-shell"><div className="capability-tabs" role="tablist" aria-label="Kravia capability areas">{capabilities.map((capability, index) => <button key={capability.title} type="button" role="tab" tabIndex={selected === index ? 0 : -1} aria-selected={selected === index} aria-controls={`capability-panel-${index}`} id={`capability-tab-${index}`} onClick={() => setSelected(index)} onKeyDown={event => onTabKeyDown(event, index)}><span>{capability.label}</span>{capability.title}</button>)}</div><div className="capability-panel" id={`capability-panel-${selected}`} role="tabpanel" tabIndex={0} aria-labelledby={`capability-tab-${selected}`}><item.Icon aria-hidden="true" /><div><p className="eyebrow">{item.label} / KRAVIA CAPABILITY</p><h3>{item.title}</h3><p>{item.copy}</p><p className="capability-detail">{item.detail}</p></div></div></div></section>;
}

export function CopyLinkButton({ label = "Copy link" }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard?.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <button type="button" className="copy-link" onClick={() => void copy()}>{copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}<span>{copied ? "Copied" : label}</span></button>;
}