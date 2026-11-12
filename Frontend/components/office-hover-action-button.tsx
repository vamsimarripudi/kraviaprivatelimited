"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./office-hover-action-button.module.css";

export type HoverActionButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  Icon: LucideIcon;
  label: string;
  tone?: "primary" | "neutral";
};

/**
 * Stable 44px control: desktop hover and keyboard focus reveal a floating
 * action label without reflow; coarse-pointer devices expose the label inline
 * so actions remain discoverable and usable without hover.
 */
export function HoverActionButton({
  Icon, label, tone = "neutral", className = "", type = "button", ...props
}: HoverActionButtonProps) {
  return <button
    {...props}
    type={type}
    title={label}
    aria-label={label}
    data-tone={tone}
    className={`${styles.action} ${className}`.trim()}
  >
    <Icon size={18} aria-hidden="true" focusable="false" />
    <span className={styles.actionLabel} aria-hidden="true">{label}</span>
  </button>;
}
