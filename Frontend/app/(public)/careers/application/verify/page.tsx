import type {Metadata} from "next";
import { Suspense } from "react";
import { CareerVerify } from "@/components/career-verify";
export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Verify candidate access | KRAVIA Careers",
  robots:{index:false,follow:false},
  referrer:"no-referrer",
};
export default function VerifyCandidatePage(){
  return <main id="main-content"><Suspense fallback={<p style={{padding:24}}>Loading secure verification…</p>}><CareerVerify/></Suspense></main>;
}
