export type VaultCategory = {
 slug: string;
 title: string;
 description: string;
 permissions: readonly string[];
 sourceHref: string;
 sourceLabel: string;
};
export const vaultCategories: readonly VaultCategory[] = [
 { slug:"identity",title:"Company identity",description:"Official registration evidence and verified company identifiers.",permissions:["registration.read"],sourceHref:"/office/registrations",sourceLabel:"Registration registry" },
 { slug:"registrations",title:"Registrations & licences",description:"Current registrations, verification reviews and renewal evidence.",permissions:["registration.read"],sourceHref:"/office/registrations",sourceLabel:"Registration registry" },
 { slug:"banking",title:"Banking & finance",description:"Controlled source records for authorized Finance personnel only.",permissions:["finance.bank.read"],sourceHref:"/finance/banking",sourceLabel:"Finance banking" },
 { slug:"legal",title:"Legal & governance",description:"Board decisions, contracts and legal obligations in their canonical sources.",permissions:["secretarial.board.read","legal.contract.review"],sourceHref:"/office/governance",sourceLabel:"Governance" },
 { slug:"people",title:"People documentation",description:"Scoped people records; sensitive HR data is not exposed by the Vault index.",permissions:["people.basic.read"],sourceHref:"/office/people",sourceLabel:"People & HR" },
 { slug:"technology",title:"Technology & assets",description:"Authorized company products and assigned physical and digital assets.",permissions:["master.product.read","operations.asset.read"],sourceHref:"/office/assets",sourceLabel:"Asset lifecycle" },
 { slug:"documents",title:"Document evidence",description:"Versioned, permission-controlled official documents and signed evidence.",permissions:["document.instance.read","document.template.read"],sourceHref:"/office/documents",sourceLabel:"Document Studio" },
 { slug:"custody",title:"Secure custody",description:"Physical originals, custody checks and secured evidence references only.",permissions:["custody.read"],sourceHref:"/office/custody",sourceLabel:"Secure Custody" },
];
export const vaultReservedPaths = [
 "company","categories","records","documents","requests","access","reviews","activity","settings",
] as const;
