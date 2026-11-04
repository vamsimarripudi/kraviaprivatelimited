"use client";

import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import GridScan from "./grid-scan";
import styles from "./technology-hero.module.css";

export const heroStatements = [
  "clearer work",
  "stronger systems",
  "safer decisions",
  "connected products",
  "useful intelligence",
] as const;

export function TechnologyHero() {
  const [statementIndex, setStatementIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const timer = window.setInterval(() => {
      setStatementIndex((current) => (current + 1) % heroStatements.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.backdrop} aria-hidden="true">
        <GridScan linesColor="#426276" scanColor="#8bd6ee" cells={8} depth={3} parallax={0.35} reflection={0.25} glow={0.4} scanDuration={3.2} scanDelay={1.8} intro={false} dpr={1.25} />
        <div className={styles.shade} />
      </div>
      <div className={styles.inner}>
        <div className={styles.content}>
          <p className={styles.eyebrow}><span aria-hidden="true" />Independent thinking. Purposeful technology.</p>
          <h1 id="home-title" className={styles.title}>Technology for<br /><span>what comes next.</span></h1>
          <p className={styles.rotatingStatement}>
            <span>Built for </span>
            <span className={styles.rotator} aria-live="polite" aria-atomic="true">
              <span key={heroStatements[statementIndex]} className={styles.rotatingWord}>{heroStatements[statementIndex]}</span>
            </span>
          </p>
          <p className={styles.description}>We are KRAVIA. An Indian technology company building software products, intelligent systems and digital infrastructure for work that matters.</p>
          <div className={styles.actions}>
            <Link href="#products" className={styles.primary}>Explore our products <ArrowUpRight aria-hidden="true" /></Link>
            <Link href="/company/about" className={styles.secondary}>Meet the company <ArrowUpRight aria-hidden="true" /></Link>
          </div>
          <p className={styles.note}>Built in India. Built with intention.</p>
        </div>
        <div className={styles.bottom}>
          <a href="#products" className={styles.discover}><ArrowDown aria-hidden="true" /><span>Discover KRAVIA</span></a>
          <p className={styles.disciplines}><span>Software products</span><span>Intelligent systems</span><span>Digital infrastructure</span></p>
        </div>
      </div>
    </section>
  );
}

