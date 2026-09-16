import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KRAVIA Office",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
