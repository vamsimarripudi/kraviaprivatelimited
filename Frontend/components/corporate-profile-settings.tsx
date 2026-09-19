"use client";

import Link from "next/link";

type Props = { email: string; fullName: string; role: string | null };

export function CorporateProfileSettings(_props: Props) {
  return <main className="profile-settings">
    <header>
      <div>
        <p className="eyebrow">KRAVIA OFFICE</p>
        <h1>Identity &amp; <em>security</em></h1>
        <p>The legacy Corporate Office account settings have been retired. Identity, MFA and access are managed through KRAVIA Office.</p>
      </div>
    </header>
    <Link className="button button-dark" href="/office/access">Open Office access administration</Link>
  </main>;
}
