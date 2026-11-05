"use client";

import { useEffect, useState } from "react";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import type { SocialProfile } from "@/lib/public-links";
import styles from "./social-links.module.css";

function SocialIcon({ platform }: { platform: SocialProfile["platform"] }) {
  if (platform === "x") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-7.4L5.6 22H2.46l7.99-9.13L.8 2h6.4l4.42 6.74L18.9 2ZM17.8 20h1.73L6.25 3.9H4.4L17.8 20Z" /></svg>;
  const Icon = { linkedin: Linkedin, instagram: Instagram, facebook: Facebook }[platform];
  return <Icon aria-hidden="true" focusable="false" />;
}

export function SocialLinks({ profiles }: { profiles: readonly SocialProfile[] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDismissed(true); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, []);

  const show = () => setDismissed(false);

  return <nav className={styles.row} aria-label="KRAVIA social media">
    {profiles.map(({ platform, label, href }) => <a
      key={platform}
      href={href}
      className={styles.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`KRAVIA on ${label} (opens in a new tab)`}
      data-tooltip-dismissed={dismissed || undefined}
      onPointerEnter={show}
      onFocus={show}
    >
      <span className={styles.icon}><SocialIcon platform={platform} /></span>
      <span className={styles.label} aria-hidden="true">{label}</span>
    </a>)}
  </nav>;
}
