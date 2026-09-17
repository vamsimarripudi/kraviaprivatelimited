import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { OfficeIntelligenceBrief } from "@/components/office-intelligence-brief";
import { requireWorkspaceIdentity } from "@/lib/office/guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficeIntelligencePage() {
  const identity = await requireWorkspaceIdentity("office", "/office/intelligence");
  const executive = identity.roles.some((role) => role === "OWNER" || role === "DIRECTOR");

  if (!executive) {
    return <main className="office office-v2 workspace-shell"><section className="office-main"><header className="office-topbar"><div><p className="eyebrow">KRAVIA INTELLIGENCE</p><h1>Company intelligence</h1></div></header><section className="office-denied"><ShieldCheck /><div><p className="eyebrow">EXECUTIVE READ MODEL</p><h2>This brief is restricted to Owner and Director authority.</h2><p>Operational modules remain available according to your normal role and permission scope.</p><Link className="text-link" href="/office/dashboard"><ArrowLeft /> Return to My work</Link></div></section></section></main>;
  }

  return <main className="office office-v2 workspace-shell"><section className="office-main"><header className="office-topbar"><div><p className="eyebrow">KRAVIA INTELLIGENCE</p><h1>Company intelligence</h1></div><div className="office-topbar-actions"><Link className="office-identity" href="/office/dashboard"><span>MY WORK</span><small>Return to Office</small></Link></div></header><div className="office-notice"><ShieldCheck /><p>Read-first executive brief. It summarizes current canonical records, does not infer missing facts, and cannot execute company actions.</p></div><OfficeIntelligenceBrief /></section></main>;
}
