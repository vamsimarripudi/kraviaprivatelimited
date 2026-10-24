"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { defaultProfileImage, type LeadershipImage } from "../../lib/leadership";
import styles from "./leadership.module.css";

/** The supplied neutral avatar is a visual fallback, never a person's structured-data portrait. */
export function LeadershipMedia({ asset, name, fallback, variant = "portrait", compact = false }: {
  asset: LeadershipImage | null;
  name: string;
  fallback: string;
  variant?: "portrait" | "logo";
  compact?: boolean;
}) {
  const [failedSources, setFailedSources] = useState<readonly string[]>([]);
  const approved = asset && !failedSources.includes(asset.src) ? asset : null;
  const image = approved ?? (variant === "portrait" && !failedSources.includes(defaultProfileImage.src) ? defaultProfileImage : null);
  const isDefault = image === defaultProfileImage;
  return (
    <div className={variant === "logo" ? styles.logo : `${styles.portrait} ${compact ? styles.compactPortrait : ""}`} data-media-state={image ? (isDefault ? "default" : "image") : "text"}>
      {image ? (
        <Image
          src={image.src}
          alt={isDefault ? `Default profile image for ${name}` : name}
          width={image.width}
          height={image.height}
          sizes={variant === "logo" ? "(max-width: 640px) 220px, 300px" : compact ? "48px" : "(max-width: 760px) 104px, 128px"}
          style={{ objectPosition: image.objectPosition ?? "50% 35%" }}
          onError={() => setFailedSources((failed) => failed.includes(image.src) ? failed : [...failed, image.src])}
        />
      ) : variant === "logo" ? (
        <span className={styles.wordmark}>{fallback}</span>
      ) : (
        <UserRound className={styles.avatarFallback} role="img" aria-label={`Profile image unavailable for ${name}`} />
      )}
    </div>
  );
}
