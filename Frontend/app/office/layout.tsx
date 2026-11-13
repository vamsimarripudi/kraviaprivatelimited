import type { Metadata } from "next";
import "./office-enterprise.css";
import "./office-platform.css";
import "./office-experience-4.css";
import "./office-shell-next.css";
import "./office-design-system.css";
import "./office-auth-responsive.css";
import "./office-mobile-contrast.css";
import "./office-surface-integrity.css";
import "./office-experience-5.css";
import { OfficeAppearanceRoot } from "@/components/office-appearance-root";

export const metadata: Metadata = {
  title: "KRAVIA Office",
  robots: { index: false, follow: false, nocache: true },
};


export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <OfficeAppearanceRoot>{children}</OfficeAppearanceRoot>;
}
