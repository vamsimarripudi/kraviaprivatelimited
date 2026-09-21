import Link from "next/link";
import { KeyRound } from "lucide-react";
import { OfficeAuthLayout } from "@/components/office-auth-layout";
import { OfficePasswordRecoveryForm } from "@/components/office-password-recovery-form";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function OfficeResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  return (
    <OfficeAuthLayout
      title="Recover KRAVIA Office access"
      description="Private administrator-issued recovery for KRAVIA-owned Office credentials."
      footerHref="/office/login"
      footerLabel="Back to sign in"
    >
      {value.length >= 64 ? (
        <OfficePasswordRecoveryForm token={value} />
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:'Inter,"Segoe UI",sans-serif'}}>
          <div style={{width:46,height:46,borderRadius:14,display:"grid",placeItems:"center",background:"#f4eee5",color:"#8a5e1e",border:"1px solid #eadbc4"}}>
            <KeyRound size={20}/>
          </div>
          <p style={{margin:0,fontSize:11,color:"#68716d",lineHeight:1.6}}>
            This recovery URL is missing its private token. Ask an authorised Office administrator to issue a new recovery link.
          </p>
          <Link href="/office/recover" style={{color:"#225c46",fontWeight:700,textDecoration:"none"}}>
            Recovery instructions
          </Link>
        </div>
      )}
    </OfficeAuthLayout>
  );
}
