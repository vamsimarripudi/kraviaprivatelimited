import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { OfficeAuthLayout } from "@/components/office-auth-layout";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function OfficeRecoveryPage() {
  return (
    <OfficeAuthLayout
      title="Recover Office access"
      description="KRAVIA Office credentials are managed by KRAVIA with controlled recovery and no public password-reset flow."
      footerHref="/office/login"
      footerLabel="Back to sign in"
    >
      <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:'Inter,"Segoe UI",sans-serif'}}>
        <div style={{width:46,height:46,borderRadius:14,display:"grid",placeItems:"center",background:"#e9f1eb",color:"#0d5a3f",border:"1px solid #d9e6dc"}}><KeyRound size={20}/></div>
        <p style={{margin:"2px 0 -8px",fontSize:10,letterSpacing:".18em",fontWeight:800,color:"#9b7331"}}>CONTROLLED RECOVERY</p>
        <h2 style={{margin:0,fontSize:32,letterSpacing:"-.035em",color:"#10241c"}}>Request a private recovery link</h2>
        <p style={{margin:0,color:"#66716b",fontSize:14,lineHeight:1.6}}>Contact the Founder or an authorised Office administrator. They can issue a short-lived, single-use recovery link from Access Governance. Issuing the link immediately revokes the account’s active sessions.</p>
        <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:13,borderRadius:13,background:"#edf5ef",border:"1px solid #d4e4d8",fontSize:12,color:"#365b49"}}><ShieldCheck size={18}/><span>No email or SMS provider is required. The link is delivered privately by an authorised administrator and becomes invalid after the password is changed.</span></div>
        <p style={{margin:0,color:"#7b817e",fontSize:11,lineHeight:1.55}}>If MFA was also lost, the administrator must separately perform the governed MFA-reset action. OWNER recovery remains outside ordinary delegated administration.</p>
        <Link href="/office/login" style={{height:50,borderRadius:14,display:"grid",placeItems:"center",background:"#0b3023",color:"#fff",textDecoration:"none",fontWeight:750,fontSize:14}}>Return to sign in</Link>
      </div>
    </OfficeAuthLayout>
  );
}
