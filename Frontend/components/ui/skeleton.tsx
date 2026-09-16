import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

type SkeletonShape = "line" | "block" | "circle";

type SkeletonProps = ComponentPropsWithoutRef<"span"> & {
  shape?: SkeletonShape;
};

/** Decorative loading placeholder. Announce loading on the containing region, not each shape. */
export function Skeleton({ className, shape = "line", ...props }: SkeletonProps) {
  return <span aria-hidden="true" className={clsx("ui-skeleton", `ui-skeleton-${shape}`, className)} {...props} />;
}
