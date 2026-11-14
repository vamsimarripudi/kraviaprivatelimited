"use client";
import Link from "next/link";
import {Office5State} from "@/components/office5-primitives";
export default function WorkspaceFailure({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main aria-label="KRAVIA Office recovery" style={{padding:"24px"}}>
  <Office5State kind="error" title="Protected workspace temporarily unavailable"
   description="The authorized operation could not be completed. No changes are treated as successful. You can retry this route or open the dashboard."
   onAction={reset} actionLabel="Retry request"/>
  <p style={{textAlign:"center"}}><Link href="/office/dashboard">Open Office dashboard</Link></p>
 </main>;
}
