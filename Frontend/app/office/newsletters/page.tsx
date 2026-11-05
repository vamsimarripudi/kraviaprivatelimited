import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {OfficeWorkspaceShell} from "@/components/office-workspace-shell";
import {PublicNewsletterManager} from "@/components/public-newsletter-manager";
import {requireWorkspaceIdentity} from "@/lib/office/guard";
import styles from "@/components/public-access.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata:Metadata={
  title:"Newsletter approvals | KRAVIA Office",
  robots:{index:false,follow:false,nocache:true},
};
export default async function NewsletterConsole(){
  const identity=await requireWorkspaceIdentity("office","/office/newsletters");
  if(!identity.roles.includes("OWNER"))notFound();
  return <OfficeWorkspaceShell workspace="office" identity={identity} permissions={[]}>
    <section className={styles.surface}><div className={styles.shell}>
      <p className={styles.eyebrow}>KRAVIA OFFICE · APPROVAL REQUIRED</p>
      <h1 className={styles.title}>Newsletter operations.</h1>
      <p className={styles.intro}>Prepare reviewed company and product updates. Only confirmed subscribers may receive a campaign, and no send takes place without explicit owner approval.</p>
      <PublicNewsletterManager/>
    </div></section>
  </OfficeWorkspaceShell>;
}
