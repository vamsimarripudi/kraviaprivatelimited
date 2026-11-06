import { Suspense, type ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { Footer } from "@/components/footer";
import { DiwaliCelebration } from "@/components/diwali-celebration";

/** Public navigation persists across routes; private workspaces keep their own layouts. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>
    <SiteNav />
    <DiwaliCelebration brand="kravia" />
    {children}
    <Suspense fallback={null}><Footer /></Suspense>
  </>;
}
