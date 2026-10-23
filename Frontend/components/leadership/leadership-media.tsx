"use client";

import Image from "next/image";
import { useState } from "react";
import type { LeadershipImage } from "../../lib/leadership";
import styles from "./leadership.module.css";

/** No requests are made for missing assets; failed approved images fall back gracefully. */
export function LeadershipMedia({ asset, name, fallback, variant = "portrait" }: {
  asset: LeadershipImage | null;
  name: string;
  fallback: string;
  variant?: "portrait" | "logo";
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = asset !== null && failedSource !== asset.src;
  return (
    <div className={variant === "logo" ? styles.logo : styles.portrait} data-media-state={showImage ? "image" : "text"}>
      {showImage ? (
        <Image
          src={asset.src}
          alt={name}
          width={asset.width}
          height={asset.height}
          sizes={variant === "logo" ? "(max-width: 640px) 220px, 300px" : "(max-width: 640px) 90vw, (max-width: 1000px) 40vw, 360px"}
          style={{ objectPosition: asset.objectPosition ?? "50% 35%" }}
          onError={() => setFailedSource(asset.src)}
        />
      ) : (
        <span className={variant === "logo" ? styles.wordmark : styles.initials} aria-hidden={variant === "portrait" ? true : undefined}>{fallback}</span>
      )}
    </div>
  );
}
