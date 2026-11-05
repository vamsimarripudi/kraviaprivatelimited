"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";
import styles from "./office-decision-dialog.module.css";

const focusableSelector =
  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function OfficeDecisionDialog({
  open,
  eyebrow = "DECISION REQUIRED",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "warning" | "danger";
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={() => { if (!busy) onCancel(); }}>
      <section
        ref={panelRef}
        className={styles.dialog}
        data-tone={tone}
        role="dialog"
        aria-modal="true"
        aria-labelledby="office-decision-title"
        aria-describedby="office-decision-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className={styles.icon} aria-hidden="true">
            {tone === "default" ? <Check /> : <AlertTriangle />}
          </div>
          <div>
            <p>{eyebrow}</p>
            <h2 id="office-decision-title">{title}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onCancel} disabled={busy} aria-label="Close decision dialog">
            <X aria-hidden="true" />
          </button>
        </header>
        <p id="office-decision-description" className={styles.description}>{description}</p>
        {children ? <div className={styles.details}>{children}</div> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={styles.confirm} data-tone={tone} onClick={onConfirm} disabled={busy}>
            {busy ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : tone === "default" ? <Check aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
