import Link from "next/link";
import { BookOpen, KeyRound, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { OfficeAuthLayout } from "@/components/office-auth-layout";

export const metadata = {
  title:"KRAVIA Office | Invitation and first access guide",
  robots:{index:false,follow:false,nocache:true},
  referrer:"no-referrer" as const,
};
const steps=[
  {title:"Confirm your private invitation",description:"Use only the invitation from an authorised KRAVIA representative. The link is time-limited and cannot be shared. Public registration is closed."},
  {title:"Create your credentials",description:"Open the exact invitation URL, confirm your corporate email and create a strong password. Complete your one-time corporate email verification."},
  {title:"Activate KRAVIA Authenticator",description:"Install the official Android app from Google Play and request approval of your exact phone. An iPhone requires an approved Apple installation route."},
  {title:"Sign in from a trusted browser",description:"Use the official KRAVIA domain, your password and the current six-digit approved factor. Approve any new browser on your registered email."},
  {title:"Complete your private Office profile",description:"Once access is activated, open My roles & onboarding. Complete truthful personal and employment evidence in the secure Office forms."},
  {title:"Read your assigned handbook",description:"Open Info & Help from your floating sidebar. Read the common guide and role supplement, then explicitly acknowledge the current version."},
];
export default function OfficeQuickStart(){
  return <OfficeAuthLayout
    eyebrow="EMPLOYEE FIRST ACCESS"
    title="Your first day in KRAVIA Office"
    description="A public-safe guide for invited colleagues. Private workspaces open only after account and device verification."
    footerHref="/office/login" footerLabel="Return to sign in">
    <section aria-label="First access steps" style={{display:"flex",flexDirection:"column",gap:16}}>
      <h2 style={{margin:0,fontSize:23,lineHeight:1.24,letterSpacing:"-.025em",fontWeight:750}}>First access: six steps</h2>
      <p style={{margin:0,fontSize:13,lineHeight:1.65}}>You do not need to know the Office system before joining. Follow the steps below in order. Each step is separate from formal employment or statutory appointment approval.</p>
      {steps.map((step,i)=><article key={step.title} style={{display:"flex",alignItems:"flex-start",gap:12,padding:13,border:"1px solid #dce5e1",borderRadius:13}}>
        <span style={{display:"grid",placeItems:"center",width:31,height:31,flex:"0 0 auto",background:"#e9f2ff",color:"#1a548f",borderRadius:9,fontWeight:800,fontSize:12}}>{i+1}</span>
        <div><strong style={{fontSize:14}}>{step.title}</strong><p style={{fontSize:12,lineHeight:1.65,margin:"5px 0 0"}}>{step.description}</p></div>
      </article>)}
      <section style={{padding:15,borderRadius:13,background:"#eaf4f2",fontSize:12}}>
        <strong><ShieldCheck size={15} style={{verticalAlign:"middle",marginRight:5}}/> Security checklist</strong>
        <p style={{margin:"7px 0 0",lineHeight:1.65}}>Use only www.kraviaprivatelimited.com. Never send passwords, codes, PAN, Aadhaar, or raw bank details in emails or tickets. The original invitation owner or authorised Office administrator handles expired links and recovery.</p>
      </section>
      <nav style={{display:"grid",gap:10}} aria-label="First access actions">
        <Link href="/office/authenticator" style={{padding:13,borderRadius:12,textAlign:"center",background:"#19456c",color:"white",fontWeight:750,textDecoration:"none",fontSize:13}}><Smartphone size={15} style={{verticalAlign:"middle",marginRight:6}}/> Install and activate Authenticator</Link>
        <Link href="/office/login" style={{padding:13,borderRadius:12,textAlign:"center",border:"1px solid #b6cbc3",color:"inherit",textDecoration:"none",fontSize:13}}><KeyRound size={15} style={{verticalAlign:"middle",marginRight:6}}/> Sign in to KRAVIA Office</Link>
        <Link href="/office/recover" style={{padding:8,textAlign:"center",color:"inherit",textDecoration:"none",fontSize:12}}><LockKeyhole size={14} style={{verticalAlign:"middle",marginRight:4}}/> Need recovery?</Link>
      </nav>
      <p style={{fontSize:11,lineHeight:1.5,margin:0,opacity:.75}}><BookOpen size={14} style={{verticalAlign:"middle",marginRight:3}}/> Full employee manuals and acknowledgement records are private and visible only after activation.</p>
    </section>
  </OfficeAuthLayout>;
}
