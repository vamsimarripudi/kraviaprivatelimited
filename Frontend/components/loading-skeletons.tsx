import { Skeleton } from "@/components/ui";
import { Menu, MessageCircle } from "lucide-react";
import heroStyles from "./technology-hero.module.css";
import navStyles from "./site-nav.module.css";
import styles from "./public-route-skeleton.module.css";

function LoadingAnnouncement({ label }: { label: string }) {
  return <p className="sr-only" role="status">{label}</p>;
}

/** Route changes replace only page content, never the shared navigation/footer. */
export function PublicContentSkeleton() {
  return <main id="main-content" className={styles.contentRoot} aria-busy="true" aria-label="Loading page">
    <LoadingAnnouncement label="Loading page" />
    <div className={styles.contentInner} aria-hidden="true">
      <Skeleton className={styles.eyebrow} />
      <div className={styles.contentTitle}><Skeleton /><Skeleton /></div>
      <div className={styles.contentCopy}><Skeleton /><Skeleton /><Skeleton /></div>
      <div className={styles.contentRows}>{[0, 1, 2].map(row => <div key={row}><Skeleton /><Skeleton /></div>)}</div>
    </div>
  </main>;
}

export function PublicRouteSkeleton() {
  return <main className={styles.root} aria-busy="true" aria-label="Loading Kravia">
    <LoadingAnnouncement label="Loading Kravia" />
    <div className={`${styles.header} ${navStyles.onDark}`} aria-hidden="true">
      <div className={navStyles.navigation}>
        <div className={`${navStyles.island} ${navStyles.brand} ${styles.brand}`}>
          <Skeleton className={styles.brandSymbol} />
          <div className={styles.wordmark}><Skeleton /><Skeleton /></div>
        </div>
        <div className={`${navStyles.island} ${navStyles.links}`}>
          {[50, 50, 65, 70, 32, 58, 48].map((width, index) => <span className={styles.navItem} key={index}><Skeleton className={styles.navLabel} style={{ width }} /></span>)}
        </div>
        <div className={`${navStyles.island} ${navStyles.menu}`}><Menu /><span><Skeleton className={styles.menuLabel} /></span></div>
        <div className={`${navStyles.island} ${navStyles.contact}`}><MessageCircle /></div>
      </div>
    </div>
    <section className={heroStyles.hero} aria-hidden="true">
      <div className={heroStyles.inner}>
        <div className={heroStyles.content}>
          <Skeleton className={styles.eyebrow} />
          <div className={`${heroStyles.title} ${styles.title}`}><Skeleton /><Skeleton /></div>
          <div className={`${heroStyles.description} ${styles.copy}`}><Skeleton /><Skeleton /><Skeleton /></div>
          <div className={heroStyles.actions}>
            <div className={`${heroStyles.primary} ${styles.button}`}><Skeleton className={styles.buttonLabel} /></div>
            <div className={`${heroStyles.secondary} ${styles.button}`}><Skeleton className={styles.buttonLabel} /></div>
          </div>
          <Skeleton className={`${heroStyles.note} ${styles.note}`} />
        </div>
        <div className={heroStyles.bottom}>
          <Skeleton className={styles.discover} />
          <div className={heroStyles.disciplines}><Skeleton /><Skeleton /><Skeleton /></div>
        </div>
      </div>
    </section>
  </main>;
}

export function SupportWorkspaceSkeleton() {
  return <main id="main-content" className="support-skeleton shell" aria-busy="true" aria-label="Preparing support workspace">
    <LoadingAnnouncement label="Preparing support workspace" />
    <section aria-hidden="true"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-display skeleton-display-medium" /><Skeleton className="skeleton-display skeleton-display-short" /><Skeleton className="skeleton-copy-long" /></section>
    <div className="support-skeleton-grid" aria-hidden="true">{Array.from({ length: 2 }, (_, index) => <article key={index}><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-card-title" /><div className="skeleton-field-grid">{Array.from({ length: index === 0 ? 6 : 3 }, (_, field) => <Skeleton key={field} className="skeleton-field" />)}</div><Skeleton className="site-skeleton-button" /></article>)}</div>
  </main>;
}

export function AdminWorkspaceSkeleton() {
  return <main className="admin-skeleton" aria-busy="true" aria-label="Loading site control">
    <LoadingAnnouncement label="Loading site control" />
    <aside aria-hidden="true"><Skeleton className="admin-skeleton-mark" />{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="admin-skeleton-nav-item" />)}</aside>
    <section aria-hidden="true"><header><div><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-display skeleton-display-short" /></div><Skeleton className="admin-skeleton-identity" /></header><div className="admin-skeleton-signals">{Array.from({ length: 4 }, (_, index) => <article key={index}><Skeleton className="skeleton-eyebrow" /><Skeleton className="admin-skeleton-number" /><Skeleton className="skeleton-line-short" /></article>)}</div></section>
  </main>;
}

export function CorporateWorkspaceSkeleton() {
  return <main className="corporate-skeleton" aria-busy="true" aria-label="Loading Corporate Office">
    <LoadingAnnouncement label="Loading Corporate Office" />
    <header className="shell" aria-hidden="true"><Skeleton className="corporate-skeleton-mark" /><div><Skeleton /><Skeleton /><Skeleton /></div><Skeleton className="admin-skeleton-identity" /></header>
    <section className="shell" aria-hidden="true"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-display skeleton-display-medium" /><div className="corporate-skeleton-grid">{Array.from({ length: 3 }, (_, index) => <article key={index}><Skeleton className="skeleton-card-mark" /><Skeleton className="skeleton-card-title" /><Skeleton /><Skeleton className="skeleton-line-short" /></article>)}</div></section>
  </main>;
}
