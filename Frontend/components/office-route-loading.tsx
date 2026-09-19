import { LoaderCircle } from "lucide-react";

export function OfficeRouteLoading() {
  return (
    <main className="office-route-skeleton" aria-busy="true" aria-live="polite">
      <aside>
        <div className="office-skeleton-brand" />
        {Array.from({ length: 9 }).map((_, index) => (
          <div className="office-skeleton-nav" key={index} />
        ))}
      </aside>
      <section>
        <header>
          <div>
            <span />
            <strong />
          </div>
          <LoaderCircle className="spin" aria-hidden="true" />
        </header>
        <div className="office-skeleton-strip" />
        <div className="office-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index}><span /><b /><i /></article>
          ))}
        </div>
      </section>
    </main>
  );
}
