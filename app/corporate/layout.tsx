import type { Metadata } from "next";
export const metadata: Metadata = { title: "Corporate Office", robots: { index: false, follow: false, nocache: true } };
export default function CorporateLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
