import type { Metadata } from "next";
import "../office/office-enterprise.css";
import "../office/office-platform.css";
import "../office/office-experience-4.css";
import "../office/office-shell-next.css";
import "../office/office-design-system.css";

export const metadata: Metadata = {
  title: "KRAVIA Finance",
  robots: { index: false, follow: false, nocache: true },
};


export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <div className="kravia-office">{children}</div>;
}
