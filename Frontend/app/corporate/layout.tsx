import type { Metadata } from "next";
export const metadata: Metadata = { title: "Corporate Office", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function CorporateLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
