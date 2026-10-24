import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { leadershipAssets, leadershipPath, publishedTeam, startupOverview, type TeamProfile } from "../../lib/leadership";
import { vidyaLumaProduct } from "../../lib/products/vidyaluma";
import { LeadershipMedia } from "./leadership-media";
import styles from "./leadership.module.css";

function Profile({ person }: { person: TeamProfile }) {
  return (
    <article id={person.id} className={styles.profile} aria-labelledby={`${person.id}-name`} data-team-group={person.group}>
      <header className={styles.profileHeader}>
        <LeadershipMedia asset={person.portrait} name={person.name} fallback="" />
        <div>
          <p className={styles.kicker}>{person.group === "founder" ? "Founding leadership" : "Team"}</p>
          <h3 id={person.id + "-name"}>{person.name}</h3>
          <p className={styles.role}>{person.title}</p>
          <p className={styles.roleDetail}>{person.roleDetail}</p>
          <div className={styles.currentFocus}><span>Current contribution</span><strong>{person.contribution}</strong></div>
        </div>
      </header>
      <div className={styles.profileBody}>
        <p className={styles.disciplines}>{person.disciplines.join(" · ")}</p>
        <div className={styles.biography}>{person.biography.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <h4>Areas of focus</h4>
        <ul className={styles.responsibilities}>{person.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </article>
  );
}

export function LeadershipContent() {
  const people = publishedTeam();
  const founders = people.filter((person) => person.group === "founder");
  const team = people.filter((person) => person.group === "team");
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} shell`} aria-labelledby="leadership-title">
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/company">Company</Link><span aria-hidden="true">/</span><span aria-current="page">Leadership &amp; Team</span>
        </nav>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.kicker}>Leadership &amp; Team</p>
            <h1 id="leadership-title">The people<br />building <em>KRAVIA.</em></h1>
            <p className={styles.lede}>{startupOverview.introduction}</p>
            <div className={styles.actions}><a className="button button-dark" href="#founding-team">Meet the team <ArrowDownRight aria-hidden="true" /></a><Link className="text-link" href={vidyaLumaProduct.href}>Explore VidyaLuma <ArrowUpRight aria-hidden="true" /></Link></div>
          </div>
          <aside className={styles.stageCard} aria-label="Company at a glance">
            <p className={styles.kicker}>Where we are today</p>
            <h2>Early-stage.<br /><em>Product-led.</em></h2>
            <dl><div><dt>Founded</dt><dd>{startupOverview.founded} · India</dd></div><div><dt>Current stage</dt><dd>{startupOverview.stage}</dd></div><div><dt>Flagship product</dt><dd>VidyaLuma</dd></div></dl>
          </aside>
        </div>
      </section>

      <section className={`${styles.about} shell`} aria-labelledby="about-team-title">
        <div><p className={styles.kicker}>01 / About our team</p><h2 id="about-team-title">Small team.<br /><em>Clear ownership.</em></h2></div>
        <div className={styles.aboutCopy}>{startupOverview.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>Our priority is to develop dependable product foundations, learn from practical workflows and prepare for wider market adoption without overstating where we are today.</p></div>
      </section>

      <section className={styles.flagship} aria-labelledby="flagship-title">
        <div className={`${styles.flagshipGrid} shell`}>
          <div><p className={styles.kicker}>02 / Our flagship product</p><LeadershipMedia asset={leadershipAssets.vidyalumaLogo} name="VidyaLuma" fallback="VidyaLuma" variant="logo" /><p className={styles.attribution}>A product by KRAVIA PRIVATE LIMITED</p><p className={styles.stageLabel}>Pre-revenue · In development</p></div>
          <div><h2 id="flagship-title">Connected school operations.<br /><em>Practical by design.</em></h2><p>VidyaLuma is our flagship education technology product, being developed to connect school administration, student records, billing, reporting and institutional communication.</p><p>Our development focus is product quality, operational reliability and usability for the people who manage a school&apos;s everyday work.</p><div className={styles.actions}><Link className="button button-light" href={vidyaLumaProduct.href}>Explore VidyaLuma <ArrowUpRight aria-hidden="true" /></Link><a className={styles.externalLink} href={vidyaLumaProduct.website} target="_blank" rel="noopener noreferrer">Visit product website <ArrowUpRight aria-hidden="true" /></a></div></div>
        </div>
      </section>

      <section id="founding-team" className={`${styles.people} shell`} aria-labelledby="founding-team-title">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>03 / Founding leadership</p><h2 id="founding-team-title">Two founders.<br /><em>Shared direction.</em></h2></div><p>Technology and product execution sit alongside executive and financial oversight, with clear responsibilities across the founding team.</p></div>
        <div className={styles.founders}>{founders.map((person) => <Profile key={person.id} person={person} />)}</div>
      </section>

      <section className={`${styles.team} shell`} aria-labelledby="key-team-title">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>04 / Our team</p><h2 id="key-team-title">Connecting product<br /><em>and market.</em></h2></div><p>Documenting product requirements and preparing clear specifications for engineering.</p></div>
        {team.map((person) => <Profile key={person.id} person={person} />)}
      </section>

      <section className={styles.working} aria-labelledby="how-we-work-title">
        <div className="shell"><div className={styles.sectionHeading}><div><p className={styles.kicker}>05 / How we work</p><h2 id="how-we-work-title">Close to the product.<br /><em>Accountable for the work.</em></h2></div></div><div className={styles.workingGrid}>
          <article><span>01</span><h3>Build with purpose</h3><p>Product planning, architecture and implementation stay connected, led by Vamsi&apos;s hands-on technical work.</p></article>
          <article><span>02</span><h3>Keep ownership clear</h3><p>Technology, business oversight and market development have defined responsibilities within a focused team.</p></article>
          <article><span>03</span><h3>Learn and improve</h3><p>We are developing our products around practical workflows and preparing to learn from customer feedback as we enter the market.</p></article>
        </div></div>
      </section>
      <section className={`${styles.closing} shell`} aria-labelledby="leadership-contact-title"><div><p className={styles.kicker}>Continue the conversation</p><h2 id="leadership-contact-title">Get to know <em>KRAVIA.</em></h2></div><div className={styles.actions}><Link className="button button-dark" href="/contact">Contact KRAVIA <ArrowUpRight aria-hidden="true" /></Link><Link className="text-link" href="/company/corporate-information">Corporate information <ArrowUpRight aria-hidden="true" /></Link></div></section>
    </div>
  );
}

export function LeadershipPreview() {
  return (
    <section className={`${styles.preview} shell`} aria-labelledby="leadership-preview-title">
      <div><p className={styles.kicker}>Leadership &amp; Team</p><h2 id="leadership-preview-title">The people<br /><em>behind the products.</em></h2><p>{startupOverview.introduction} Our flagship, VidyaLuma, is in pre-revenue product development.</p><Link className="text-link" href={leadershipPath}>Meet our leadership and team <ArrowUpRight aria-hidden="true" /></Link></div>
      <ul>{publishedTeam().map((person) => <li key={person.id}><Link href={leadershipPath + "#" + person.id}><LeadershipMedia asset={person.portrait} name={person.name} fallback="" compact /><span><strong>{person.name}</strong><small>{person.title}</small></span><ArrowUpRight aria-hidden="true" /></Link></li>)}</ul>
    </section>
  );
}
