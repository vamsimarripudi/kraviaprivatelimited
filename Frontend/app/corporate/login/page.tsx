import Link from "next/link";
import { CorporateLoginForm } from "@/components/corporate-login-form";

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

export default async function CorporateLogin({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  const nextPath = next?.startsWith("/corporate") ? next : "/corporate/dashboard";
  return <main className="office-login"><div><p className="eyebrow">KRAVIA PRIVATE LIMITED</p><h1>Corporate<br /><em>Office</em></h1><p>This restricted system is for authorised directors and professionals. Access is provisioned by invitation—there is no public registration.</p><Link href="/" className="text-link">Return to public website</Link></div><section className="login-card" aria-label="Corporate Office sign in"><CorporateLoginForm nextPath={nextPath} configurationRequired={reason === "configuration_required"} /></section></main>;
}