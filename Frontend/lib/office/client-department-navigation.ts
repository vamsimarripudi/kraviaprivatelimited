/** Client-only navigation projection over server-issued authorizations.
 * It is not a permission grant and never replaces backend record authorization. */
export const officeDepartmentLabels:Record<string,string>={
  "EXECUTIVE": "Executive",
  "PEOPLE": "People & HR",
  "FINANCE": "Finance",
  "PRODUCT": "Product",
  "OPERATIONS": "Operations",
  "LEGAL": "Legal",
  "SECRETARIAL": "Secretarial",
  "ADMINISTRATION": "Administration",
  "AUDIT": "Audit",
  "CUSTOMER_SUCCESS": "Customer Success",
  "DEVOPS": "Platform / DevOps",
  "ENGINEERING": "Engineering",
  "IT": "IT",
  "MARKETING": "Marketing",
  "PROCUREMENT": "Procurement",
  "QUALITY": "Quality Engineering",
  "SALES": "Sales",
  "SECURITY": "Security",
  "SUPPORT": "Customer Support",
  "TAX": "Tax & GST"
};
const personal=new Set(["dashboard","my-role","my-transfers","info","notifications","tasks","calendar","requests","approvals","manager","emergency","worktime","settings"]);
const companyControl=new Set(["department-ownership","role-packages","access","audit","readiness","decisions","strategy","intelligence","data","security","devices","domains","ai"]);
export const officeSectionDepartments:Record<string,readonly string[]>={
  "recruitment": [
    "PEOPLE"
  ],
  "people": [
    "PEOPLE"
  ],
  "development": [
    "PEOPLE"
  ],
  "payroll": [
    "FINANCE",
    "PEOPLE"
  ],
  "budget": [
    "FINANCE"
  ],
  "cards": [
    "FINANCE"
  ],
  "products": [
    "PRODUCT"
  ],
  "portfolio": [
    "PRODUCT"
  ],
  "engineering": [
    "ENGINEERING"
  ],
  "quality": [
    "QUALITY"
  ],
  "integrations": [
    "DEVOPS",
    "ENGINEERING"
  ],
  "customers": [
    "SALES",
    "CUSTOMER_SUCCESS"
  ],
  "crm": [
    "SALES"
  ],
  "support": [
    "SUPPORT",
    "CUSTOMER_SUCCESS"
  ],
  "governance": [
    "SECRETARIAL"
  ],
  "registrations": [
    "SECRETARIAL",
    "LEGAL"
  ],
  "documents": [
    "SECRETARIAL",
    "LEGAL",
    "EXECUTIVE"
  ],
  "custody": [
    "SECRETARIAL",
    "SECURITY"
  ],
  "contracts": [
    "LEGAL"
  ],
  "compliance": [
    "LEGAL",
    "TAX"
  ],
  "privacy": [
    "LEGAL"
  ],
  "ethics": [
    "LEGAL",
    "AUDIT"
  ],
  "trust": [
    "LEGAL",
    "CUSTOMER_SUCCESS"
  ],
  "vendors": [
    "PROCUREMENT"
  ],
  "assets": [
    "OPERATIONS"
  ],
  "travel": [
    "OPERATIONS"
  ],
  "facilities": [
    "OPERATIONS",
    "ADMINISTRATION"
  ],
  "it": [
    "IT"
  ],
  "knowledge": [
    "OPERATIONS",
    "SECRETARIAL",
    "LEGAL"
  ],
  "resilience": [
    "SECURITY",
    "OPERATIONS"
  ],
  "department-ownership": [
    "ADMINISTRATION"
  ],
  "role-packages": [
    "ADMINISTRATION"
  ],
  "access": [
    "ADMINISTRATION"
  ],
  "audit": [
    "AUDIT"
  ],
  "readiness": [
    "SECURITY"
  ],
  "decisions": [
    "EXECUTIVE"
  ],
  "strategy": [
    "EXECUTIVE"
  ],
  "intelligence": [
    "EXECUTIVE"
  ],
  "data": [
    "ADMINISTRATION"
  ],
  "security": [
    "SECURITY"
  ],
  "devices": [
    "IT",
    "ADMINISTRATION"
  ],
  "domains": [
    "DEVOPS"
  ],
  "ai": [
    "PRODUCT"
  ]
};
export function isOfficePersonalSection(slug:string){return personal.has(slug);}
export function clientOfficeSectionCategory(slug:string,assignedDepartments:readonly string[],founder:boolean):string|null{
 if(personal.has(slug))return "My work";
 if(founder&&companyControl.has(slug))return "Company Control";
 const codes=officeSectionDepartments[slug];
 if(!codes)return null;
 const assigned=codes.find(code=>assignedDepartments.includes(code));
 return assigned?officeDepartmentLabels[assigned]??null:null;
}
