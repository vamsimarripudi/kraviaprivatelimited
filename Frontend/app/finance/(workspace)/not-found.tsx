import {Office5State} from "@/components/office5-primitives";
export default function FinanceNotFound(){
 return <main aria-label="Unavailable Finance module" style={{padding:"24px"}}>
  <Office5State kind="not-found" href="/finance/dashboard" actionLabel="Return to Finance"/>
 </main>;
}
