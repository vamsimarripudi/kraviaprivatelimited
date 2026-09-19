"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function OfficeNavLink({ href, children, className, "aria-label": ariaLabel }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === href;

  const prefetch = useCallback(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch
      className={className}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onPointerDown={prefetch}
    >
      {children}
    </Link>
  );
}
