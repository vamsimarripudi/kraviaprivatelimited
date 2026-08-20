"use client";

import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/site";
import { BrandLogo } from "@/components/brand-logo";
import { SiteScrollProgress } from "@/components/premium-interactions";
import { Drawer } from "@/components/ui";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return <header className={`nav-wrap ${scrolled ? "nav-scrolled" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <nav className="nav shell" aria-label="Main navigation">
      <Link href="/" className="wordmark" aria-label="Kravia home"><BrandLogo priority animated /></Link>
      <div className="nav-links">
        {navItems.map(([label, href]) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>{label}</Link>)}
        <Link href="/contact" className="nav-cta">Talk to Kravia <ArrowUpRight size={14} /></Link>
      </div>
      <button className="menu-btn" type="button" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" /><span className="sr-only">Open menu</span>
      </button>
    </nav>
    <Drawer open={open} onClose={() => setOpen(false)} title="Kravia navigation">
      <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>{label}</Link>)}
        <Link onClick={() => setOpen(false)} href="/contact" className="nav-cta">Talk to Kravia <ArrowUpRight size={14} /></Link>
      </nav>
    </Drawer>
    <SiteScrollProgress />
  </header>;
}