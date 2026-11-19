/**
 * Client-side OFFICE navigation only.
 * Department visibility is not an authorization boundary: existing APIs
 * and database policies remain responsible for all protected data access.
 *
 * Never show unrelated operational departments merely because an account
 * carries an executive/administrator role or a permission from a profile.
 */

export const OFFICE_DEPARTMENT_LABELS: Readonly<Record<string,string>>={
 EXECUTIVE:"Executive",FINANCE:"Finance",PEOPLE:"HR",PRODUCT:"Product",
 OPERATIONS:"Operations",LEGAL:"Legal",SECRETARIAL:"Secretarial",
 ADMINISTRATION:"Administration",AUDIT:"Audit",CUSTOMER_SUCCESS:"Customer Success",
 DEVOPS:"Platform / DevOps",ENGINEERING:"Engineering",IT:"IT",
 MARKETING:"Marketing",PROCUREMENT:"Procurement",QUALITY:"Quality Engineering",
 SALES:"Sales",SECURITY:"Security",SUPPORT:"Customer Support",TAX:"Tax & GST",
};

export const OFFICE_PERSONAL_SECTIONS=new Set([
 "dashboard","my-role","my-transfers","info","notifications","tasks",
 "calendar","requests","approvals","manager","worktime","emergency","device-recovery",
 "development","travel","it","knowledge","ethics","settings",
]);

export const OFFICE_OWNER_CONTROL_SECTIONS=new Set([
 "department-ownership","role-packages","access","devices","data","readiness","audit",
]);

export const OFFICE_DEPARTMENT_SECTIONS:Readonly<Record<string,readonly string[]>>={
 EXECUTIVE:["decisions","strategy","intelligence"],
 FINANCE:["payroll","budget","cards"],
 PEOPLE:["recruitment","people"],
 PRODUCT:["products","portfolio"],
 OPERATIONS:["assets","facilities"],
 LEGAL:["contracts","privacy","trust"],
 SECRETARIAL:["governance","registrations","compliance","documents","custody"],
 ADMINISTRATION:[],
 AUDIT:[],
 CUSTOMER_SUCCESS:["customer-success"],
 DEVOPS:["integrations","domains"],
 ENGINEERING:["engineering"],
 IT:[],
 MARKETING:[],
 PROCUREMENT:["vendors"],
 QUALITY:["quality"],
 SALES:["crm","customers"],
 SECURITY:["security","resilience","ai"],
 SUPPORT:["support"],
 TAX:[],
};

export type OfficeDepartmentOwnershipSnapshot={
 actor:{user_id:string};
 departments:{code:string;label:string}[];
 ownership:{department_code:string;owner_user_id:string}[];
};

const codeBySlug=new Map<string,string>();
for(const [code,slugs] of Object.entries(OFFICE_DEPARTMENT_SECTIONS)){
 for(const slug of slugs){
  if(codeBySlug.has(slug))throw new Error("Duplicate Office department module: "+slug);
  codeBySlug.set(slug,code);
 }
}
export function officeDepartmentForSection(slug:string):string|null{
 return codeBySlug.get(slug)??null;
}
export function officeDepartmentLabel(code:string):string{
 return OFFICE_DEPARTMENT_LABELS[code]??code.replaceAll("_"," ");
}
export function officeAssignedDepartmentCodes(
 snapshot:OfficeDepartmentOwnershipSnapshot,
 actorId:string,
 primaryDepartment:string|null|undefined,
):string[]{
 if(!actorId||snapshot.actor.user_id!==actorId)return [];
 const known=new Set(Object.keys(OFFICE_DEPARTMENT_LABELS));
 const available=new Set(snapshot.departments.map(d=>d.code).filter(code=>known.has(code)));
 const owned=new Set(snapshot.ownership.filter(row=>row.owner_user_id===actorId)
  .map(row=>row.department_code).filter(code=>available.has(code)));
 // A signed-in employee's assigned primary department is a valid workspace
 // context even when the ownership API omits non-owner membership rows.
 const primary=(primaryDepartment??"").toUpperCase();
 if(known.has(primary))owned.add(primary);
 return [...owned].sort((a,b)=>officeDepartmentLabel(a).localeCompare(officeDepartmentLabel(b)));
}
export function officeClientSectionVisible(
 slug:string,
 assignedDepartments:readonly string[],
 isFounder:boolean,
):boolean{
 if(OFFICE_PERSONAL_SECTIONS.has(slug))return true;
 if(OFFICE_OWNER_CONTROL_SECTIONS.has(slug))return isFounder;
 const department=officeDepartmentForSection(slug);
 return department!==null&&assignedDepartments.includes(department);
}
export function officeClientCategoryForSection(slug:string,isFounder:boolean):string{
 if(OFFICE_PERSONAL_SECTIONS.has(slug))return "My work";
 if(OFFICE_OWNER_CONTROL_SECTIONS.has(slug))return isFounder?"Company control":"My work";
 const code=officeDepartmentForSection(slug);
 return code?officeDepartmentLabel(code):"My work";
}
