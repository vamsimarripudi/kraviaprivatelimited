import Link from "next/link";
import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { OfficeRegisterForm } from "@/components/office-register-form";
import { founderBootstrapStatus, invitationStatus } from "@/lib/office/auth-server";
import { founderBootstrapIsPermitted } from "@/lib/office/bootstrap";

type Props = { searchParams: Promise<{ invite?: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Closed({ message }: { message: string }) {
  return <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:'Inter,"Segoe UI",sans-serif'}}>
    <p style={{fontSize:10,letterSpacing:".17em",fontWeight:800,color:"#9b7331",margin:0}}>REGISTRATION CONTROL</p>
    <h2 style={{fontSize:32,letterSpacing:"-.035em",margin:0,color:"#11261d"}}>Registration unavailable</h2>
    <p style={{fontSize:14,lineHeight:1.6,color:"#68736d",margin:0}}>{message}</p>
    <Link href="/office/login" style={{height:48,borderRadius:13,background:"#0b3023",color:"#fff",display:"grid",placeItems:"center",textDecoration:"none",fontWeight:750}}>Return to sign in</Link>
  </div>;
}

async function loadInvitation(token: string) {
  try {
    return await invitationStatus(token);
  } catch {
    return null;
  }
}

async function bootstrapIsOpen() {
  try {
    return (await founderBootstrapStatus()).registration_open;
  } catch {
    return null;
  }
}

export default async function OfficeRegisterPage({ searchParams }: Props) {
  const { invite } = await searchParams;

  if (invite) {
    const invitation = await loadInvitation(invite);
    if (!invitation) {
      return <OfficeAuthLayout title="Private registration" description="KRAVIA invitation links are single-use, time-limited and tied to a specific corporate identity.">
        <Closed message="This private registration link is invalid, expired, revoked or already used. Ask the person who invited you to issue a new link." />
      </OfficeAuthLayout>;
    }

    return <OfficeAuthLayout
      title="Private registration"
      description="Your access was prepared inside KRAVIA Office. Complete identity setup and MFA to activate it."
      footerHref="/office/login"
      footerLabel="Already registered? Sign in"
    >
      <OfficeRegisterForm
        mode="invite"
        inviteToken={invite}
        email={invitation.email}
        displayName={invitation.display_name ?? ""}
        roles={invitation.roles}
      />
    </OfficeAuthLayout>;
  }

  if (!founderBootstrapIsPermitted()) {
    return <OfficeAuthLayout>
      <Closed message="Founder registration is unavailable on this public deployment. New people can join only through private links issued inside KRAVIA Office." />
    </OfficeAuthLayout>;
  }

  const bootstrapOpen = await bootstrapIsOpen();
  if (bootstrapOpen === null) {
    return <OfficeAuthLayout>
      <Closed message="The KRAVIA identity service is not ready. Registration remains closed until the service is available." />
    </OfficeAuthLayout>;
  }
  if (!bootstrapOpen) {
    return <OfficeAuthLayout>
      <Closed message="Founder registration has already been completed. Public registration is permanently disabled; new people can join only through private links issued inside KRAVIA Office." />
    </OfficeAuthLayout>;
  }

  return <OfficeAuthLayout
    title="Founder setup"
    description="Create the first KRAVIA Office identity. This one-time bootstrap closes public registration immediately after success."
    footerHref="/office/login"
    footerLabel="Already registered? Sign in"
  >
    <OfficeRegisterForm mode="founder" roles={["FOUNDER"]} />
  </OfficeAuthLayout>;
}
