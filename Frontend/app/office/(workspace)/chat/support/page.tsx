import Link from "next/link";
import { InternalWorkspaceScreen } from "@/components/internal-workspace-screen";
export default function ConnectSupport(){
 return <section aria-label="Connect support bridge">
  <nav style={{display:"flex",gap:12,flexWrap:"wrap",margin:"16px 24px"}} aria-label="Canonical support systems">
   <Link href="/office/it">IT service desk</Link>
   <Link href="/office/support">Customer Support</Link>
   <Link href="/office/chat">Connect conversations</Link>
  </nav>
  <InternalWorkspaceScreen workspace="office" section="it"/>
 </section>;
}
