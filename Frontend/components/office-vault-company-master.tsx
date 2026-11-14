import Link from "next/link";
import {FolderClosed} from "lucide-react";
import {getOfficeRegistrationOverview} from "@/lib/office/registration-server";
import {getOfficeVaultGrantedResources,getOfficeVaultSourceVisibleRecordIds} from "@/lib/office/vault-access-server";
import {OfficeVaultCompanyRecords,type CompanyMasterRow} from "@/components/office-vault-company-records";
export async function OfficeVaultCompanyMaster(){
 const grants=await getOfficeVaultGrantedResources("identity");
 if(!grants.length)return <section role="status" aria-label="Restricted company master">
  <FolderClosed aria-hidden="true"/><h2>No company master record grant</h2>
  <p>Active, explicit Vault access is required in addition to canonical registration permission.</p>
  <Link href="/office/k-vault/requests">Request governed access</Link></section>;
 const source=await getOfficeRegistrationOverview();
 const visible=await getOfficeVaultSourceVisibleRecordIds("identity",source.registrations);
 const rows:CompanyMasterRow[]=source.registrations.filter(row=>visible.has(row.id)&&
  (grants.includes(null)||grants.includes(row.id))).map(row=>({
   id:row.id,title:row.title,code:row.registration_code,
   type:row.registration_type,authority:row.authority,jurisdiction:row.jurisdiction,
   maskedIdentifier:row.identifier_masked,status:row.status,issuedOn:row.issued_on,
   expiresOn:row.expires_on,renewalOn:row.renewal_due_on,updatedAt:row.updated_at,
   verified:!!row.verified_at,evidenceLinked:!!row.evidence_reference
  }));
 return <OfficeVaultCompanyRecords records={rows} generatedAt={source.generated_at}/>;
}
