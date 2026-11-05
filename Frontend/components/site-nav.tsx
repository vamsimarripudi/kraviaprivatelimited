"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/site";
import { SiteScrollProgress } from "@/components/premium-interactions";
import { Drawer } from "@/components/ui";
import GooeyNav from "./gooey-nav";
import { observeNavigationSurface } from "./site-nav-lifecycle";
import styles from "./site-nav.module.css";

const gooeyItems = navItems.map(([label, href]) => ({ label, href }));
const gooeyStyle = {
  "--gn-font": "12px",
  "--gn-x": "10px",
  "--gn-y": "6px",
  "--gn-ink": "var(--nav-foreground)",
  "--gn-muted": "var(--nav-foreground)",
} as CSSProperties;

export function SiteNav() {
  const pathname = usePathname();
  const header = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState({ pathname, open: false });
  const [overDarkSurface, setOverDarkSurface] = useState(pathname === "/");

  // The shell persists between routes. Discard an open drawer on every path
  // change, including history navigation, rather than reviving it on return.
  if (menu.pathname !== pathname) setMenu({ pathname, open: false });
  const open = menu.pathname === pathname && menu.open;
  const setOpen = (value: boolean) => setMenu({ pathname, open: value });

  useEffect(() => {
    if (header.current) return observeNavigationSurface(header.current, setOverDarkSurface);
  }, [pathname]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return <header ref={header} className={`nav-wrap ${styles.root} ${overDarkSurface ? styles.onDark : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <nav className={styles.navigation} aria-label="Main navigation">
      <Link href="/" className={`${styles.island} ${styles.brand}`} aria-label="Kravia Private Limited home">
        <Image className={styles.logo} src="/brand/kravia-header-lockup-v2.png" alt="Kravia Private Limited" width={1086} height={362} priority sizes="(max-width: 600px) 116px, 138px" />
      </Link>
      <div className={`${styles.island} ${styles.links}`}>
        <GooeyNav
          items={gooeyItems}
          activeIndex={navItems.findIndex(([, href]) => isCurrent(href))}
          theme={overDarkSurface ? "dark" : "light"}
          color={overDarkSurface ? "#a7d9e6" : "#071e45"}
          activeTextColor={overDarkSurface ? "#06101e" : "#f8fafc"}
          size="sm"
          frame={false}
          animationTime={500}
          particleCount={10}
          spread={20}
          gooeyness={0.45}
          wobble={0.25}
          style={gooeyStyle}
        />
      </div>
      <button className={`${styles.island} ${styles.menu}`} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" /><span>Menu</span>
      </button>
      <Link href="/contact" className={`${styles.island} ${styles.contact}`} aria-label="Contact Kravia" title="Contact Kravia" aria-current={isCurrent("/contact") ? "page" : undefined}>
        <MessageCircle aria-hidden="true" focusable="false">
          <circle className={styles.contactDot} cx="8" cy="11" r="1" />
          <circle className={styles.contactDot} cx="12" cy="11" r="1" />
          <circle className={styles.contactDot} cx="16" cy="11" r="1" />
        </MessageCircle>
      </Link>
    </nav>
    <Drawer open={open} onClose={() => setOpen(false)} title="Kravia navigation">
      <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
        <p className="mobile-nav-kicker">Explore Kravia</p>
        <div className="mobile-nav-links">
          {navItems.map(([label, href], index) => <Link onClick={() => setOpen(false)} key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{label}
          </Link>)}
        </div>
        <Link onClick={() => setOpen(false)} href="/contact" className="nav-cta mobile-nav-cta">Talk to Kravia <ArrowUpRight size={16} /></Link>
      </nav>
    </Drawer>
    {pathname !== "/" ? <SiteScrollProgress /> : null}
  </header>;
}
