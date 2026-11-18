"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Rss, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { filterProductReleaseNotes, productReleaseNotes, type ProductReleaseNote } from "@/lib/products/release-notes";
import styles from "./product-release-notes.module.css";

const products = ["All", ...new Set(productReleaseNotes.map((note) => note.product))];
const kinds = ["All", ...new Set(productReleaseNotes.map((note) => note.type))];

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
}

function ReleaseNoteArticle({ note }: { note: ProductReleaseNote }) {
  return (
    <article className={styles.entry} id={note.slug} aria-labelledby={note.slug + "-title"}>
      <div className={styles.entryAside}>
        <span className={styles.entryProduct}>{note.product}</span>
        <time dateTime={note.publishedOn}>{displayDate(note.publishedOn)}</time>
        <span className={styles.status}>{note.type}</span>
      </div>
      <div className={styles.entryBody}>
        <div className={styles.entryTopline}>
          <span>PRODUCT UPDATE · DEVELOPMENT RECORD</span>
          <a href={"#" + note.slug} aria-label={"Link to " + note.title}>Permalink <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
        <h2 id={note.slug + "-title"}>{note.title}</h2>
        <p className={styles.lead}>{note.summary}</p>
        <div className={styles.availability} role="note">
          <strong>Availability</strong>
          <p>{note.availability}</p>
        </div>
        <section className={styles.readable} aria-labelledby={note.slug + "-audience"}>
          <h3 id={note.slug + "-audience"}>Designed for school teams</h3>
          <p>Connect is intended to keep school communication close to the everyday work it supports, with access governed by school membership and responsibility.</p>
          <ul className={styles.inlineList}>{note.audience.map((audience) => <li key={audience}>{audience}</li>)}</ul>
        </section>
        <section className={styles.readable} aria-labelledby={note.slug + "-built"}>
          <h3 id={note.slug + "-built"}>What has been built in the codebase</h3>
          <div className={styles.featureGrid}>{note.built.map((item, index) => (
            <div className={styles.feature} key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </div>
          ))}</div>
        </section>
        <section className={styles.readable} aria-labelledby={note.slug + "-workflow"}>
          <h3 id={note.slug + "-workflow"}>How the experience is intended to work</h3>
          <ol className={styles.steps}>{note.workflow.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <section className={styles.readable} aria-labelledby={note.slug + "-trust"}>
          <h3 id={note.slug + "-trust"}>Privacy, safety and technical boundaries</h3>
          <ul className={styles.points}>{note.safeguards.map((point) => <li key={point}>{point}</li>)}</ul>
        </section>
        <section className={styles.readable} aria-labelledby={note.slug + "-next"}>
          <h3 id={note.slug + "-next"}>What must happen before a broader release</h3>
          <ul className={styles.points}>{note.beforeRelease.map((point) => <li key={point}>{point}</li>)}</ul>
        </section>
        <footer className={styles.entryFooter}>
          <div>
            <h3>Current public product information</h3>
            <p>The official VidyaLuma website governs which features and plans are actually available. This engineering update is not a launch announcement.</p>
            <div className={styles.referenceLinks}>{note.references.map((source) => (
              <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">{source.label} <ArrowUpRight size={15} aria-hidden="true" /></a>
            ))}</div>
          </div>
        </footer>
      </div>
    </article>
  );
}

export function ProductReleaseNotes() {
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("All");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const filtered = useMemo(() => filterProductReleaseNotes({ product, type, query, sort }), [product, type, query, sort]);
  function clearFilters() { setQuery(""); setProduct("All"); setType("All"); setSort("newest"); }
  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero}>
        <div className={"shell " + styles.heroInner}>
          <div><p className="eyebrow">KRAVIA / PRODUCT JOURNAL</p>
            <h1>Release notes<span> &amp; development updates.</span></h1>
            <p className={styles.intro}>A chronological record of meaningful changes across KRAVIA products—what we are building, what is being tested and what has actually been released.</p>
          </div>
          <a className={styles.rss} href="/products/release-notes/rss.xml" type="application/rss+xml"><Rss aria-hidden="true" size={17} /> Subscribe via RSS <ArrowUpRight aria-hidden="true" size={16} /></a>
        </div>
      </section>
      <div className={"shell " + styles.content}>
        <section className={styles.controls} aria-label="Filter product updates">
          <div className={styles.productTabs} role="group" aria-label="Select a product">
            {products.map((name) => <button key={name} type="button" aria-pressed={product === name} className={product === name ? styles.isSelected : ""} onClick={() => setProduct(name)}>{name === "All" ? "All products" : name}</button>)}
          </div>
          <div className={styles.filterRow}>
            <label className={styles.search}><Search size={18} aria-hidden="true" /><span className="sr-only">Search release notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search updates" autoComplete="off" /></label>
            <div className={styles.selectWrap}><SlidersHorizontal size={16} aria-hidden="true" /><label htmlFor="release-note-type">Update type</label><select id="release-note-type" value={type} onChange={(event) => setType(event.target.value)}>{kinds.map((kind) => <option key={kind} value={kind}>{kind === "All" ? "All updates" : kind}</option>)}</select></div>
            <div className={styles.selectWrap}><label htmlFor="release-note-sort">Sort</label><select id="release-note-sort" value={sort} onChange={(event) => setSort(event.target.value === "oldest" ? "oldest" : "newest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
          </div>
        </section>
        <div className={styles.results} aria-live="polite"><span>{filtered.length} {filtered.length === 1 ? "update" : "updates"}</span><span>Source-reviewed · Availability stated per entry</span></div>
        <section className={styles.feed} aria-label="Product update timeline">
          {filtered.map((note) => <ReleaseNoteArticle key={note.slug} note={note} />)}
          {!filtered.length && <div className={styles.empty}><h2>No matching updates</h2><p>Try another product, update type or search term. Published entries remain available in the archive.</p><button type="button" onClick={clearFilters}>Clear filters <ArrowRight size={16} aria-hidden="true" /></button></div>}
        </section>
        <div className={styles.bottom}><p>KRAVIA publishes reviewed product information, not raw engineering activity. New entries are added when there is a verified and useful change to communicate.</p><Link href="/products/vidyaluma">Explore VidyaLuma <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </main>
  );
}
