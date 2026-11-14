"use client";
import Link from "next/link";
import {Office5State} from "@/components/office5-primitives";
export default function FinanceFailure({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main aria-label="KRAVIA Finance recovery" style={{padding:"24px"}}>
  <Office5State kind="error" title="Finance workspace temporarily unavailable"
   description="The source did not confirm the requested action. Retry when ready. No payment, payroll or journal state is assumed to have changed."
   onAction={reset} actionLabel="Retry request"/>
  <p style={{textAlign:"center"}}><Link href="/finance/dashboard">Open Finance dashboard</Link></p>
 </main>;
}
