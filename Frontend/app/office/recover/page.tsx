import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { OfficeAuthLayout } from "@/components/office-auth-layout";

export default function OfficeRecoveryPage() {
  return (
    <OfficeAuthLayout
      title="Recover Office access"
      description="KRAVIA Office credentials are managed by KRAVIA. Recovery is controlled to prevent account takeover."
      footerHref="/office/login"
      footerLabel="Back to sign in"
    >
      <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:'Inter,"Segoe UI",sans-serif'}}>
        <div style={{width:46,height:46,borderRadius:14,display:"grid",placeItems:"center",background:"#e9f1eb",color:"#0d5a3f",border:"1px solid #d9e6dc"}}><KeyRound size={20}/></div>
        <p style={{margin:"2px 0 -8px",fontSize:10,letterSpacing:".18em",fontWeight:800,color:"#9b7331"}}>CONTROLLED RECOVERY</p>
        <h2 style={{margin:0,fontSize:32,letterSpacing:"-.035em",color:"#10241c"}}>Contact your Office administrator</h2>
        <p style={{margin:0,color:"#66716b",fontSize:14,lineHeight:1.6}}>Self-service email recovery is disabled during the first-party identity rollout. Contact the Founder or an authorised Office administrator to restore access or reset MFA.</p>
        <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:13,borderRadius:13,background:"#edf5ef",border:"1px solid #d4e4d8",fontSize:12,color:"#365b49"}}><ShieldCheck size={18}/><span>Passwords and MFA are no longer controlled by Supabase Auth.</span></div>
        <Link href="/office/login" style={{height:50,borderRadius:14,display:"grid",placeItems:"center",background:"#0b3023",color:"#fff",textDecoration:"none",fontWeight:750,fontSize:14}}>Return to sign in</Link>
      </div>
    </OfficeAuthLayout>
  );
}
