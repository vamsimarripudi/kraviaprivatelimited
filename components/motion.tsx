"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

const words = ["products.", "systems.", "intelligence.", "infrastructure.", "experiences."];
export function HeroMotion() { const reduce = useReducedMotion(); const [index, setIndex] = useState(0); useEffect(() => { if (reduce) return; const timer = setInterval(() => setIndex(i => (i + 1) % words.length), 2400); return () => clearInterval(timer); }, [reduce]); return <div className="hero-title"><div className="hero-logo-field" aria-hidden="true"><Image src="/brand/kravia-logo.png" alt="" width={247} height={251} priority /></div><p>KRAVIA PRIVATE LIMITED</p><h1>Building technology<br />for <span>what comes next.</span></h1><div className="we-build">We build <motion.span key={words[index]} initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>{words[index]}</motion.span></div></div>; }
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) { const reduce = useReducedMotion(); return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>; }
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) { return <section className="page-hero shell"><p className="eyebrow">{eyebrow}</p><motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>{title}</motion.h1><p className="lede">{intro}</p></section>; }
export function ProductLink() { return <Link className="button button-dark" href="/contact">Talk to Kravia <ArrowUpRight /></Link>; }
