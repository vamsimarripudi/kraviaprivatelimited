"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const priorActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const frame = window.requestAnimationFrame(focusFirst);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const elements = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); priorActiveElement?.focus(); };
  }, [onClose, open]);

  if (!open) return null;
  return <div className="ui-drawer-backdrop" role="presentation" onMouseDown={onClose}>
    <aside ref={panelRef} className="ui-drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><p className="eyebrow">NAVIGATION</p><button type="button" className="ui-icon-button" onClick={onClose} aria-label="Close navigation"><X aria-hidden="true" /></button></header>
      {children}
    </aside>
  </div>;
}
