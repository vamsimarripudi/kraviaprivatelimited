"use client";
import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/site";
import { BrandLogo } from "@/components/brand-logo";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 12); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <header className={`nav-wrap ${scrolled ? "nav-scrolled" : ""}`}><nav className="nav shell" aria-label="Main navigation"><Link href="/" className="wordmark" aria-label="Kravia home"><BrandLogo priority /></Link><div className="nav-links">{navItems.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}<Link href="/contact" className="nav-cta">Talk to Kravia <ArrowUpRight size={14} /></Link></div><button className="menu-btn" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}<span className="sr-only">Menu</span></button></nav>{open && <div id="mobile-nav" className="mobile-nav shell">{navItems.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href}>{label}</Link>)}<Link onClick={() => setOpen(false)} href="/contact">Talk to Kravia</Link></div>}</header>;
}