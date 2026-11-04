import { Suspense, type ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { Footer } from "@/components/footer";

/** Public navigation persists across routes; private workspaces keep their own layouts. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>
    <SiteNav />
    {children}
    <Suspense fallback={null}><Footer /></Suspense>
  </>;
}
