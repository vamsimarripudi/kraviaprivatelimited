import {notFound} from "next/navigation";
import {OfficeConnectWorkflows} from "@/components/office-connect-workflows";
import {OfficeConnectMessageIndex} from "@/components/office-connect-message-index";
import {OfficeConnectThread} from "@/components/office-connect-thread";
import {OfficeConnectEscalations} from "@/components/office-connect-escalations";
import {OfficeConnectTicket} from "@/components/office-connect-ticket";
import {OfficeConnectSharedFiles} from "@/components/office-connect-shared-files";
import {OfficeConnectGovernance} from "@/components/office-connect-governance";
import {OfficeConnectChannels} from "@/components/office-connect-channels";
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
 const detail=/^threads\/[0-9a-f-]{36}$/i.test(path)||/^support\/tickets\/[0-9a-f-]{36}$/i.test(path)||
              /^support\/escalations\/[0-9a-f-]{36}$/i.test(path)||
              /^support\/knowledge\/[0-9a-f-]{36}$/i.test(path)||
              /^approvals\/[0-9a-f-]{36}$/i.test(path);
 if(!permittedPaths.has(path)&&!detail)notFound();
 if(/^support\/tickets\/[0-9a-f-]{36}$/i.test(path))
   return <OfficeConnectTicket id={segments[2]}/>;
 if(path==="support/escalations" || /^support\/escalations\/[0-9a-f-]{36}$/i.test(path))
   return <OfficeConnectEscalations detailId={segments[2]}/>;
 if(path==="files")return <OfficeConnectSharedFiles/>;
 if(path==="admin/permissions")return <OfficeConnectGovernance/>;
 if(path==="admin/channels")return <OfficeConnectChannels/>;
 if(path==="search"||path==="saved"||path==="mentions")
   return <OfficeConnectMessageIndex kind={path}/>;
 if(/^threads\/[0-9a-f-]{36}$/i.test(path))
   return <OfficeConnectThread id={segments[1]}/>;
 return <OfficeConnectWorkflows path={path}/>;
}
