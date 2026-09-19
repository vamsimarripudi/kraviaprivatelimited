import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "KRAVIA Office",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

export default function CorporateLayout({ children: _children }: { children: React.ReactNode }) {
  redirect("/office/dashboard");
}
