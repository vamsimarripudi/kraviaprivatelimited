"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

const words = ["products.", "systems.", "intelligence.", "infrastructure.", "experiences."];

export function HeroMotion() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % words.length), 2400);
    return () => clearInterval(timer);
  }, [reduce]);

  return <div className="hero-title">
    <div className="hero-logo-field" aria-hidden="true"><Image src="/brand/kravia-logo.png" alt="" width={247} height={251} priority /></div>
    <p>KRAVIA PRIVATE LIMITED</p>
    <h1>Building technology<br />for <span>what comes next.</span></h1>
    <div className="we-build">
      <span className="we-build-animated" aria-hidden="true">
        <span>We build</span>
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={words[index]}
            initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? undefined : { opacity: 0, y: -10, filter: "blur(3px)" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >{words[index]}</motion.span>
        </AnimatePresence>
      </span>
      <span className="sr-only">We build products, systems, intelligence, infrastructure, and experiences.</span>
    </div>
  </div>;
}

export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  const reduce = useReducedMotion();
  return <section className="page-hero shell"><p className="eyebrow">{eyebrow}</p><motion.h1 initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, ease: [0.22, 1, 0.36, 1] }}>{title}</motion.h1><motion.p className="lede" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : .08, duration: .46, ease: [0.22, 1, 0.36, 1] }}>{intro}</motion.p></section>;
}

export function ProductLink() {
  return <Link className="button button-dark" href="/contact">Talk to Kravia <ArrowUpRight /></Link>;
}
