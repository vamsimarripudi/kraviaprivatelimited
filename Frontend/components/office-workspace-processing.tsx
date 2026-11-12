"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceSignOutButton } from "@/components/workspace-sign-out-button";

export function OfficeWorkspaceProcessing({ displayName, initialStatus }: {
  displayName?: string;
  initialStatus: "PENDING" | "REQUESTED";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function requestActivation() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/office-auth/workspace-activation", {
        method: "POST", credentials: "same-origin", cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Unable to submit request");
      setStatus("REQUESTED");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit workspace request");
    } finally {
      setPending(false);
    }
  }
  return <main style={{
    minHeight:"100dvh",display:"grid",placeItems:"center",background:"#f3f7f4",padding:"24px",
    color:"#173c2d",fontFamily:"Inter,system-ui,Arial,sans-serif",
  }}>
    <section style={{width:"min(100%,480px)",background:"#fff",border:"1px solid #d6e3da",borderRadius:20,
      padding:"32px",boxShadow:"0 16px 55px rgba(10,50,27,.06)",display:"grid",gap:15}}>
      <p style={{margin:0,fontSize:11,fontWeight:700,letterSpacing:".12em"}}>KRAVIA PRIVATE LIMITED · OFFICE ACCESS</p>
      <div aria-hidden="true" style={{width:48,height:48,borderRadius:14,display:"grid",placeItems:"center",background:"#e6f1e9",fontSize:24}}>🔒</div>
      <h1 style={{fontSize:25,margin:0,letterSpacing:"-.035em"}}>Workspace is processing</h1>
      <p style={{margin:0,lineHeight:1.6,color:"#496256",fontSize:14}}>
        {displayName ? `Hello ${displayName}. ` : ""}
        Your corporate identity is verified. Your operational workspace remains locked until the Founder approves your assigned access.
      </p>
      <p role="status" style={{margin:0,fontSize:13,fontWeight:600,color:"#385f4a"}}>
        {status === "REQUESTED" ? "Activation requested — awaiting Founder approval" : "Role assignment / activation pending"}
      </p>
      {error ? <p role="alert" style={{color:"#a32927",margin:0,fontSize:13}}>{error}</p> : null}
      {status === "PENDING" ? <button type="button" disabled={pending} onClick={() => void requestActivation()}
        style={{border:0,borderRadius:11,padding:13,fontWeight:700,color:"#fff",background:"#123d30",cursor:"pointer"}}>
        {pending ? "Submitting request…" : "Request workspace activation"}
      </button> : null}
      <button type="button" onClick={() => router.refresh()} style={{background:"#fff",color:"#123d30",
        border:"1px solid #c9dacf",padding:12,borderRadius:11,fontWeight:650,cursor:"pointer"}}>
        Check access status
      </button>
      <div style={{display:"flex",justifyContent:"flex-end"}}><WorkspaceSignOutButton workspace="office" /></div>
    </section>
  </main>;
}
