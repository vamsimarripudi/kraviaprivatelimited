"use client";

import Link from "next/link";

type Props = { nextPath: string; configurationRequired?: boolean; recoveryPath?: string };

export function CorporateLoginForm(_props: Props) {
  return <div className="corporate-auth-form">
    <h2>Moved to KRAVIA Office</h2>
    <p>The legacy Corporate Office identity system has been retired. Use the company-owned KRAVIA Office sign-in.</p>
    <Link className="button button-dark corporate-auth-submit" href="/office/login">Open KRAVIA Office</Link>
  </div>;
}
