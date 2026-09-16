import { Skeleton } from "@/components/ui";

function LoadingAnnouncement({ label }: { label: string }) {
  return <p className="sr-only" role="status">{label}</p>;
}

export function PublicRouteSkeleton() {
  return <main className="site-skeleton" aria-busy="true" aria-label="Loading Kravia">
    <LoadingAnnouncement label="Loading Kravia" />
    <div className="site-skeleton-nav shell" aria-hidden="true"><Skeleton className="site-skeleton-mark" /><div><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div><Skeleton className="site-skeleton-action" /></div>
    <section className="site-skeleton-hero shell" aria-hidden="true"><Skeleton className="skeleton-eyebrow" /><Skeleton className="skeleton-display skeleton-display-wide" /><Skeleton className="skeleton-display skeleton-display-medium" /><div className="site-skeleton-copy"><Skeleton /><Skeleton /><Skeleton className="skeleton-line-short" /></div><Skeleton className="site-skeleton-button" /></section>
    <section className="site-skeleton-grid shell" aria-hidden="true"><Skeleton className="skeleton-section-label" />{Array.from({ length: 3 }, (_, index) => <article key={index}><Skeleton className="skeleton-card-mark" /><Skeleton className="skeleton-card-title" /><Skeleton /><Skeleton className="skeleton-line-short" /></article>)}</section>
  </main>;
}

export function SupportWorkspaceSkeleton() {
  return <main className="support-skeleton shell" aria-busy="true" aria-label="Preparing support workspace">
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
