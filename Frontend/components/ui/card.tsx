import clsx from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CardVariant = "standard" | "product" | "trust" | "contact" | "feature";

type CardProps = ComponentPropsWithoutRef<"article"> & {
  variant?: CardVariant;
  interactive?: boolean;
};

export function Card({ className, variant = "standard", interactive = false, ...props }: CardProps) {
  return <article className={clsx("ui-card", `ui-card-${variant}`, interactive && "ui-card-interactive", className)} {...props} />;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <header className={clsx("ui-card-header", className)}>{children}</header>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={clsx("ui-card-title", className)}>{children}</h3>;
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("ui-card-description", className)}>{children}</p>;
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("ui-card-content", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={clsx("ui-card-footer", className)}>{children}</footer>;
}
