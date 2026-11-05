import {notFound} from "next/navigation";
import {OfficeWorkspaceShell} from "@/components/office-workspace-shell";
import {OfficePublicResources} from "@/components/office-public-resources";
import {requireWorkspaceIdentity} from "@/lib/office/guard";
export const dynamic="force-dynamic";
export const revalidate=0;
export default async function OfficePublicResourcesPage(){
 const identity=await requireWorkspaceIdentity("office","/office/public-resources");
 if(!identity.roles.includes("OWNER"))notFound();
 return <OfficeWorkspaceShell workspace="office" identity={identity} permissions={[]}>
  <OfficePublicResources/>
 </OfficeWorkspaceShell>;
}
