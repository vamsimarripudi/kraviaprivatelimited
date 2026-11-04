const darkSurfaceSelector = 'section[aria-labelledby="home-title"], .dark-section, .signature-prefooter, [data-nav-theme="dark"]';

/** Keep a persistent navbar in sync when a streamed page replaces its fallback. */
export function observeNavigationSurface(header: HTMLElement, onChange: (dark: boolean) => void) {
  let frame: number | null = null;
  let disposed = false;

  const measure = () => {
    frame = null;
    if (disposed) return;
    const bounds = header.getBoundingClientRect();
    const center = bounds.top + bounds.height / 2;
    const dark = Array.from(document.querySelectorAll(darkSurfaceSelector)).some((surface) => {
      const box = surface.getBoundingClientRect();
      return box.top <= center && box.bottom > center;
    });
    onChange(dark);
  };

  const schedule = () => {
    if (!disposed && frame === null) frame = window.requestAnimationFrame(measure);
  };

  const observer = new MutationObserver(schedule);
  // Ignore animation/style attributes, including the navbar's own theme update.
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();

  return () => {
    disposed = true;
    observer.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frame !== null) window.cancelAnimationFrame(frame);
  };
}
