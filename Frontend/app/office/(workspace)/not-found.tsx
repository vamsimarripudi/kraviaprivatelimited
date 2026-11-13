import {Office5State} from "@/components/office5-primitives";
export default function OfficeNotFound(){
 return <main aria-label="Unavailable Office module" style={{padding:"24px"}}>
  <Office5State kind="not-found" href="/office/dashboard" actionLabel="Return to Office"/>
 </main>;
}
