import type { Metadata } from "next";
import "../office/office-enterprise.css";

export const metadata: Metadata = {
  title: "KRAVIA Finance",
  robots: { index: false, follow: false, nocache: true },
};


export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
