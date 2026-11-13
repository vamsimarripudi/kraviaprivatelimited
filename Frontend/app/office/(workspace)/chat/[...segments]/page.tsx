import {notFound} from "next/navigation";
import {OfficeConnectWorkflows} from "@/components/office-connect-workflows";
type Props={params:Promise<{segments:string[]}>};
export const dynamic="force-dynamic";
const permittedPaths=new Set([
 "support/new","support/mine","support/assigned","support/team",
 "support/sla","support/knowledge","support/analytics","support/macros",
 "support/customers","support/escalations",
 "mentions","saved","files","search","announcements","ai","settings",
 "admin","admin/channels","admin/queues","admin/sla","admin/retention",
 "admin/integrations","admin/permissions"
]);
export default async function OtherConnectRoute({params}:Props){
 const {segments}=await params;
 const path=segments.join("/");
 if(path==="wireframe-lab")notFound();
 const detail=/^support\/tickets\/[0-9a-f-]{36}$/i.test(path)||
              /^support\/escalations\/[0-9a-f-]{36}$/i.test(path)||
              /^support\/knowledge\/[0-9a-f-]{36}$/i.test(path)||
              /^approvals\/[0-9a-f-]{36}$/i.test(path);
 if(!permittedPaths.has(path)&&!detail)notFound();
 return <OfficeConnectWorkflows path={path}/>;
}
