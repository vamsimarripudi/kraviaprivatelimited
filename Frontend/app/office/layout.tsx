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
import "./office-chat-ux-20261114.css";
import "./office-experience-6.css";
import "./office-connect-mobile-reference.css";
import "./office-mobile-repair-20261115.css";
import "./office-layout-stability-chat-first-20261115.css";
import "./office-enterprise-contrast-and-boundaries-20261115.css";
import "./office-search-theme-20261116.css";
import "./office-client-departments.css";
import "./office-topbar-focus-20261116.css";
import { OfficeAppearanceRoot } from "@/components/office-appearance-root";

export const metadata: Metadata = {
  title: "KRAVIA Office",
  robots: { index: false, follow: false, nocache: true },
};


export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return <OfficeAppearanceRoot>{children}</OfficeAppearanceRoot>;
}
