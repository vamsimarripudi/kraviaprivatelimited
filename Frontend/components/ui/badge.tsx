import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

type BadgeTone = "neutral" | "information" | "success" | "warning" | "critical";

export function Badge({ className, tone = "neutral", ...props }: ComponentPropsWithoutRef<"span"> & { tone?: BadgeTone }) {
  return <span className={clsx("ui-badge", `ui-badge-${tone}`, className)} {...props} />;
}
