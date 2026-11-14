import {notFound} from "next/navigation";
import {OfficeConnectWorkflows} from "@/components/office-connect-workflows";
import {OfficeConnectMessageIndex} from "@/components/office-connect-message-index";
import {OfficeConnectThread} from "@/components/office-connect-thread";
import {OfficeConnectEscalations} from "@/components/office-connect-escalations";
import {OfficeConnectTicket} from "@/components/office-connect-ticket";
import {OfficeConnectSharedFiles} from "@/components/office-connect-shared-files";
import {OfficeConnectGovernance} from "@/components/office-connect-governance";
import {OfficeConnectChannels} from "@/components/office-connect-channels";
import {OfficeConnectRetention} from "@/components/office-connect-retention";
import {OfficeConnectSettings} from "@/components/office-connect-settings";
import {OfficeConnectAdmin} from "@/components/office-connect-admin";
import {OfficeConnectServiceGovernance} from "@/components/office-connect-service-governance";
import {OfficeConnectCustomerWorkspace} from "@/components/office-connect-customer-workspace";
import {OfficeConnectMacros} from "@/components/office-connect-macros";
import {OfficeConnectAnnouncements} from "@/components/office-connect-announcements";
import {OfficeConnectApprovals} from "@/components/office-connect-approvals";
import {OfficeConnectIntegrations} from "@/components/office-connect-integrations";
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
 if(path==="support/customers"||path==="support/analytics")return <OfficeConnectCustomerWorkspace mode={path==="support/analytics"?"analytics":"customers"}/>;
 if(path==="admin/queues"||path==="admin/sla")return <OfficeConnectServiceGovernance mode={path==="admin/queues"?"queues":"sla"}/>;
 if(path==="support/macros")return <OfficeConnectMacros/>;
 if(path==="announcements")return <OfficeConnectAnnouncements/>;
 if(/^approvals\/[0-9a-f-]{36}$/i.test(path))return <OfficeConnectApprovals requestId={segments[1]}/>;
 if(path==="admin")return <OfficeConnectAdmin/>;
 if(path==="admin/permissions")return <OfficeConnectGovernance/>;
 if(path==="admin/channels")return <OfficeConnectChannels/>;
 if(path==="admin/retention")return <OfficeConnectRetention/>;
 if(path==="admin/integrations")return <OfficeConnectIntegrations/>;
 if(path==="settings")return <OfficeConnectSettings/>;
 if(path==="search"||path==="saved"||path==="mentions")
   return <OfficeConnectMessageIndex kind={path}/>;
 if(/^threads\/[0-9a-f-]{36}$/i.test(path))
   return <OfficeConnectThread id={segments[1]}/>;
 return <OfficeConnectWorkflows path={path}/>;
}
