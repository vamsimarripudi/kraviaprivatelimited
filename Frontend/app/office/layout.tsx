import type { Metadata } from "next";
import "./office-enterprise.css";
import "./office-platform.css";
import "./office-experience-4.css";
import "./office-shell-next.css";

export const metadata: Metadata = {
  title: "KRAVIA Office",
  robots: { index: false, follow: false, nocache: true },
};


export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <div className="kravia-office">{children}</div>;
}
