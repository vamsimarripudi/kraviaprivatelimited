import Link from "next/link";

type Props = { searchParams: Promise<{ reason?: string }> };

export default async function CorporateLogin({ searchParams }: Props) {
  const { reason } = await searchParams;
  return <main className="office-login"><div><p className="eyebrow">KRAVIA PRIVATE LIMITED</p><h1>Corporate<br /><em>Office</em></h1><p>This restricted system is for authorised directors and professionals. Access is provisioned by invitation—there is no public registration.</p><Link href="/" className="text-link">Return to public website</Link></div><section className="login-card" aria-labelledby="office-access-title"><h2 id="office-access-title">Authorised access</h2>{reason === "configuration_required" ? <p className="office-config">Corporate identity is not configured in this environment. No internal records are available.</p> : <p>Continue only with an invitation-provisioned Kravia account. Privileged roles require multi-factor authentication.</p>}<p>Supabase Auth, redirect URLs and MFA policy must be configured before an authorised sign-in flow is activated.</p></section></main>;
}
