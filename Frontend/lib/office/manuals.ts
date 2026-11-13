/** Versioned, non-sensitive guide metadata. Access comes only from the Office permission engine. */
export const OFFICE_MANUAL_VERSION = "2026-11-13.1";
export const OFFICE_MANUAL_EDITION = "13 November 2026";

export type ManualRole = {
  id: string;
  name: string;
  purpose: string;
  firstDay: string[];
  daily: string[];
  completion: string;
  boundaries: string;
  routes: readonly string[];
};

type RoleRow = readonly [string, string, string, string, string, string, string, string];
const source: readonly RoleRow[] = [
  ["founder-owner","Founder / Owner","Oversight, strategic decisions and delegated corporate authority.","Verify own identity, onboarding and the company's pending decisions.","Review exceptions and accountable owners, record decisions, assign scoped authority, verify evidence.","Documented decision or delegated work with an independent audit trail.","Do not bypass former-department-owner restrictions, professional reviews, or self-approve pay.","dashboard,approvals,decisions,strategy,portfolio,access,role-packages,department-ownership,readiness,audit"],
  ["board-director-ceo","Board Director / CEO","Direct strategy and govern company-level decisions.","Confirm director appointment evidence and the company decision register.","Review strategy, board decisions, risk, finance exceptions and delegated responsibilities.","Reviewed decision with recorded rationale, approver and supporting evidence.","A title alone does not authorize treasury actions or override separation of duties.","dashboard,decisions,strategy,governance,approvals,portfolio,readiness"],
  ["coo-operations-head","COO / Operations Head","Coordinate operational departments and service delivery.","Verify operating authority and assigned departments.","Review portfolio blockers, procurement, facilities, travel, customer issues and incident handoffs.","Assigned operational outcomes closed with verified evidence.","Finance transfers, people appointments and department handovers require separate authorization.","dashboard,manager,portfolio,vendors,assets,facilities,it,travel,support,approvals"],
  ["cfo-finance-head","CFO / Finance Head","Control financial records, treasury reviews, budgets and statutory evidence.","Confirm finance authority and maker-checker restrictions.","Review budget and cash commitments, billing, reconciliation, payment decisions, payroll and tax evidence.","Balanced, reviewed and source-evidenced financial records.","No bank execution, tax filing or payroll payout is complete without external confirmation.","dashboard,budget,approvals,documents,finance:dashboard,finance:billing,finance:payments,finance:banking,finance:reconciliation,finance:payroll,finance:gst,finance:accounting"],
  ["cto-engineering-head","CTO / Engineering Head","Govern engineering delivery, security and approved technical changes.","Verify assigned repositories, services, release ownership and on-call procedures.","Review technical incidents, delivery milestones, engineering changes, quality and risks.","Tested technical change with review evidence and independently verified release status.","Repository privileges and production deployments must respect assigned scopes and approvals.","dashboard,engineering,portfolio,products,quality,security,it,domains,approvals"],
  ["cdo-data-head","CDO / Data Head","Govern data use, movement, privacy and approved AI processing.","Confirm data permissions and classification requirements.","Review requested imports/exports, privacy controls, data risks and AI use cases.","Approved and traceable movement or processing with minimization.","No data exfiltration, sensitive upload or AI processing without explicit authority.","dashboard,data,privacy,ai,security,trust,decisions,audit"],
  ["head-admin-access","Head Admin / Access Administrator","Govern invitations, roles, devices and lifecycle access.","Check authorized Access administration capability and approval boundaries.","Review invitation states, recovery cases, role changes, devices and removal requests.","Audited access change with requester, reason and approval.","Only the Owner can assign Owner-protected powers; never share credentials or impersonate acceptance.","dashboard,access,role-packages,department-ownership,devices,settings,approvals,security"],
  ["company-secretary","Company Secretary","Maintain corporate governance, board records and statutory evidence.","Confirm qualified Company Secretary appointment and document access.","Prepare board agenda, minutes and resolutions, review compliance obligations and registration records.","Reviewed, signed and dated corporate record with authoritative supporting evidence.","CS means Company Secretary; software records alone are not statutory filings.","dashboard,governance,compliance,registrations,documents,approvals,audit"],
  ["chartered-accountant","Chartered Accountant","Review financial records, reconciliations and tax evidence.","Confirm Finance access and audit review scope.","Inspect financial statements, tax working papers, periods, reconciliation and supporting documents.","Professionally reviewed financial working papers and documented exceptions.","No assumption that an external return was filed or an amount paid solely from an Office status.","finance:dashboard,finance:gst,finance:accounting,finance:banking,finance:reconciliation,finance:documents,finance:compliance,finance:audit"],
  ["legal-counsel","Legal Counsel","Review contracts, obligations, confidentiality and legal evidence.","Confirm legal access scope and current contract register.","Prepare and review agreements, track obligations, assess issues and maintain document evidence.","Executed or reviewed evidence with verifiable signature and obligation owner.","Draft approval is not legal execution; avoid unrestricted personnel records.","dashboard,contracts,documents,privacy,compliance,governance,approvals"],
  ["hr-people-manager","HR / People Manager","Coordinate verified employee recruitment, onboarding and workforce records.","Review People access, existing employment registry and employee evidence.","Handle requisitions, private intake review, independent verification, worktime corrections and employee development.","Independently verified HR record with actual effective dates and approvals.","Never approve your own attendance, bank evidence, salary or legal appointment.","dashboard,people,recruitment,development,worktime,payroll,manager,approvals"],
  ["department-manager","Department Manager","Manage reporting-line tasks and scoped approvals.","Check manager assignment and direct reports.","Review assigned team tasks, risks and requests, escalate approvals outside your department.","Completed work with valid report, evidence and authorized review.","Managing employees is not permission to change company-wide roles or payments.","dashboard,manager,tasks,approvals,requests,portfolio,development"],
  ["engineering-team-lead","Engineering Team Lead","Coordinate technical delivery and supervise assigned engineering work.","Confirm team, repositories, service access and quality standards.","Prioritize assigned issues, review changes, triage incidents and link verified tests.","Reviewed engineering delivery linked to project/task records.","A team lead cannot bypass production release control or view unrelated code secrets.","dashboard,engineering,portfolio,tasks,quality,requests,it"],
  ["full-stack-developer","Full Stack Developer","Deliver assigned frontend/backend work using governed repositories.","Verify assigned team, project, repo and engineering SOP.","Start tasks, code, test, link PR and test evidence, request review and record blockers.","Reviewed code and documented tests; deployment is a separate recorded event.","Developer title alone does not grant CTO or production approval authority.","dashboard,tasks,portfolio,engineering,quality,it,requests,worktime"],
  ["product-manager","Product Manager","Coordinate roadmaps, product changes and dependencies.","Review product roadmap, team and assigned outcomes.","Plan milestones, track customer requirements and request governed releases.","Evidence-backed product milestone with authorized release decision.","Do not promise live functionality or pricing without verified source.","dashboard,products,portfolio,crm,customers,tasks,approvals"],
  ["sales-crm-marketing","Sales / CRM / Marketing","Maintain pipeline evidence and controlled commercial handoffs.","Check assigned CRM, product scope and customer-data handling.","Review leads, update opportunities, request contract and billing handoffs.","Accurate CRM record with verified next step and approved downstream handoff.","Sales access is not approval to issue invoices or disclose customer data.","dashboard,crm,customers,products,requests,contracts,portfolio"],
  ["customer-support","Customer Support","Resolve customer cases and escalate remedies through approved workflows.","Confirm product/customer case scope and service policies.","Triage cases, document customer context, propose remedies and escalate approvals.","Case closed with validated resolution and authorized customer communication.","Refunds, credits and sensitive disclosures require independent approval.","dashboard,support,requests,approvals,knowledge,trust"],
  ["finance-analyst-payroll","Finance Analyst / Payroll","Prepare expense, payroll and reconciliation evidence.","Confirm financial scopes and payroll confidentiality.","Reconcile records, prepare payroll evidence and mark exceptions for independent review.","Reviewed books, wage evidence or payment instruction with correct status.","Preparing salary batches does not prove a bank transfer or legal pay entitlement.","finance:dashboard,finance:payroll,finance:accounting,finance:reconciliation,finance:payments,finance:expenses"],
  ["recruiter-people-ops","Recruiter / People Operations","Coordinate approved hiring, document requests and onboarding progress.","Confirm requisition approval and candidate privacy restrictions.","Review candidates, schedule interviews, prepare offers and request onboarding.","Verified recruiting state with recorded offer and authorization evidence.","Recruiter cannot independently activate identities or certify signatures.","dashboard,recruitment,people,requests,documents,approvals"],
  ["procurement-facilities","Procurement / Facilities","Maintain sourcing, assets, workplace and vendor records.","Confirm approved budget and procurement/physical-office scopes.","Create requests, compare quotes, review receipts and manage asset handoffs.","Verified order, receipt or facility issue closure with evidence.","Vendor approval and payment are separate from a purchase request.","dashboard,vendors,assets,facilities,travel,requests,approvals"],
  ["it-security-administrator","IT / Security Administrator","Resolve device, access and security incidents inside assigned authority.","Review trusted devices and incident escalation contacts.","Triage IT tickets, license assignments, managed device states and security alerts.","Resolution with audit evidence and user confirmation.","Never obtain employee passwords or use an administrator account as the employee.","dashboard,it,devices,security,access,domains,requests"],
  ["quality-compliance-risk","Quality / Compliance / Risk","Track findings, applicability, CAPA and controlled risk actions.","Confirm approved control register and report scopes.","Review nonconformances, evidence, risk decisions and independent corrective-action checks.","Independently verified corrective action or compliance evidence.","An internal green badge cannot substitute for professional or statutory clearance.","dashboard,quality,compliance,decisions,readiness,audit"],
  ["independent-auditor","Independent Auditor","Review scoped records and evidence without executing business operations.","Verify appointment, read-only profiles and intended audit scope.","Inspect documentary records, control events and reconciliation evidence.","Evidence-backed finding with provenance and recommendations.","Do not alter records, assume completion from dashboards or approve own findings.","finance:dashboard,finance:audit,finance:documents,finance:compliance,finance:reconciliation"],
  ["general-employee","General Employee","Work securely and follow assigned operational procedures.","Complete your profile, learn the Office menu, read assigned policies.","Check in for actual work, complete tasks and track requests and notifications.","Task outcome supported by evidence and any required independent approval.","No access to other employees' records or department modules without an explicit grant.","dashboard,my-role,notifications,tasks,calendar,requests,approvals,worktime,settings"],
  ["intern","Intern","Learn within assigned projects and request supervised review.","Review approved internship start, mentor, access profile and learning plan.","Track assigned tasks, ask for review, log actual worktime where applicable.","Reviewed assignment with mentor feedback and valid evidence.","Internship is not a privileged Office role or payroll authorization.","dashboard,my-role,tasks,requests,knowledge,worktime"],
  ["trainee","Trainee","Complete supervised learning and assigned work safely.","Confirm mentor, training tasks, device and induction policies.","Follow SOPs, track training tasks and ask for authorization before changes.","Verified training outcome and supervisor acknowledgement.","Trainee status never conveys department or financial permissions.","dashboard,my-role,tasks,requests,knowledge,worktime"],
] as const;

export const manualRoles: readonly ManualRole[] = source.map(([id,name,purpose,firstDay,daily,completion,boundaries,routes]) => ({
  id,name,purpose, firstDay:firstDay.split(". ").filter(Boolean),daily:daily.split(". ").filter(Boolean),completion,boundaries,
  routes:routes.split(",").map(value => value.trim()),
}));

export function roleById(id:string):ManualRole|undefined {
  return manualRoles.find(role => role.id===id);
}

export function resolveManualRoleIds(input:{
  roles:readonly string[]; jobTitle?:string|null; positionCodes?:readonly string[];
  relationship?:string|null;
}):string[] {
  const searchable = [input.jobTitle,...(input.positionCodes??[])].filter(Boolean).join(" ").toUpperCase();
  const found:string[]=[];
  const add=(id:string)=>{if(!found.includes(id))found.push(id)};
  // An Owner always gets the protected Owner handbook; other duties are supplemental.
  if(input.roles.includes("OWNER"))add("founder-owner");
  const patterns:[RegExp,string][]=[
    [/CHIEF.EXECUTIVE|\bCEO\b|DIRECTOR/,"board-director-ceo"],
    [/CHIEF.OPERAT|\bCOO\b|OPERATIONS.HEAD/,"coo-operations-head"],
    [/CHIEF.FINANC|\bCFO\b|FINANCE.HEAD/,"cfo-finance-head"],
    [/CHIEF.TECH|\bCTO\b|TECHNOLOGY.HEAD/,"cto-engineering-head"],
    [/CHIEF.DATA|\bCDO\b|DATA.HEAD/,"cdo-data-head"],
    [/HEAD.ADMIN|ACCESS.ADMIN/,"head-admin-access"],
    [/COMPANY.SECRETARY|\bCS\b|SECRETARIAL/,"company-secretary"],
    [/CHARTERED.ACCOUNTANT|\bCA\b/,"chartered-accountant"],
    [/LEGAL|COUNSEL/,"legal-counsel"],
    [/HR|HUMAN.RESOURCES|PEOPLE.MANAGER/,"hr-people-manager"],
    [/ENGINEERING.LEAD|TECH.LEAD/,"engineering-team-lead"],
    [/FULL.STACK|FULLSTACK|SOFTWARE.ENGINEER|DEVELOPER/,"full-stack-developer"],
    [/PRODUCT.MANAGER/,"product-manager"],
    [/SALES|MARKETING|\bCRM\b/,"sales-crm-marketing"],
    [/CUSTOMER.SUPPORT|CUSTOMER.CARE/,"customer-support"],
    [/FINANCE.ANALYST|PAYROLL|ACCOUNTANT/,"finance-analyst-payroll"],
    [/RECRUITER|TALENT.ACQUISITION|PEOPLE.OPERATIONS/,"recruiter-people-ops"],
    [/PROCUREMENT|FACILITIES|PURCHASE/,"procurement-facilities"],
    [/SECURITY.ADMIN|\bIT\b.ADMIN|SYSTEM.ADMIN/,"it-security-administrator"],
    [/QUALITY|COMPLIANCE|RISK/,"quality-compliance-risk"],
    [/AUDITOR|AUDIT/,"independent-auditor"],
    [/DEPARTMENT.HEAD|TEAM.MANAGER|MANAGER/,"department-manager"],
    [/INTERN/,"intern"],
    [/TRAINEE/,"trainee"],
  ];
  for(const [pattern,id] of patterns)if(pattern.test(searchable))add(id);
  const relationship=input.relationship?.toUpperCase();
  if(relationship==="TRAINEE")add("trainee");
  if(relationship==="INTERN")add("intern");
  if(!found.length) {
    if(input.roles.includes("CS"))add("company-secretary");
    else if(input.roles.includes("CA"))add("chartered-accountant");
    else if(input.roles.includes("LEGAL"))add("legal-counsel");
    else if(input.roles.includes("HR"))add("hr-people-manager");
    else if(input.roles.includes("AUDITOR"))add("independent-auditor");
    else if(input.roles.includes("FINANCE"))add("finance-analyst-payroll");
    else if(input.roles.includes("ADMIN"))add("head-admin-access");
    else if(input.roles.includes("OPERATIONS"))add("coo-operations-head");
    else if(input.roles.includes("PRODUCT_ADMIN"))add("product-manager");
    else if(input.roles.includes("DIRECTOR"))add("board-director-ceo");
    else add("general-employee");
  }
  return found.slice(0,6);
}

export const commonManual: readonly {id:string;title:string;steps:readonly string[]}[]=[
  {id:"invitation",title:"1. Invitation and registration",steps:[
    "Open the exact private invitation URL from the authorised KRAVIA sender. Public Office registration is closed.",
    "Check the email, your assigned identity and invitation expiry. Ask the inviter to reissue an expired link.",
    "Create a strong password and complete corporate email verification. Do not reuse a password or forward codes.",
  ]},
  {id:"authenticator",title:"2. Authenticator and trusted browser",steps:[
    "Install the official KRAVIA Authenticator on an approved Android phone. An iPhone requires an approved distribution channel.",
    "Activate the phone with corporate credentials and the verification process; an authorised administrator reviews the device.",
    "Sign in at /office/login or /finance/login; enter your current six-digit code or use the approved alternative.",
    "If the browser is new, review the exact device details and approve the request from your registered corporate email.",
  ]},
  {id:"profile",title:"3. Employee profile and joining evidence",steps:[
    "Open My roles & onboarding to confirm your actual primary role, department, reporting line and required checklist.",
    "Expand Personal details, education, bank and signed onboarding. Save a private draft before uploading files.",
    "Submit truthful contact, education, tax and signed-document references through the private form, never via public chat.",
    "Wait for independent HR and Finance verification. Submitted does not mean verified; employee ID is issued separately.",
  ]},
  {id:"workday",title:"4. Start and end a workday",steps:[
    "Use the Office status control and select the actual work mode, then Check in when work starts; sign-in alone does not record worktime.",
    "Start and end unpaid breaks; Check out when finished. Check your recorded net time in Attendance & salary slips.",
    "The documented weekday target is six net hours, with a 30-hour Monday–Friday total where applicable to your current policy.",
    "Potential overtime and salary slip figures do not mean extra pay or actual bank settlement without authorised evidence.",
  ]},
  {id:"work",title:"5. Tasks, requests and approvals",steps:[
    "My work shows work assigned to you. Tasks are execution work, requests initiate governed workflows, and approvals require independently granted authority.",
    "For a request choose New request, select the correct type, enter title, reason, priority and resource scope, then submit.",
    "Follow the approval timeline for decisions. Approval does not itself send money, create a user or deploy production code.",
    "Start and complete assigned tasks with supporting references. Mark blocked work explicitly and record the next action.",
  ]},
  {id:"knowledge",title:"6. Policies, documents and communication",steps:[
    "Read current policies and internal SOPs in Policy & knowledge when your access permits it.",
    "Acknowledge only the published version you actually reviewed. Acknowledgement is not the same as legal signature.",
    "Documents, support cases, IT tickets and company requests remain independently controlled. Do not share raw identity or bank documents in chats or tickets.",
  ]},
  {id:"security",title:"7. Security, recovery and access boundaries",steps:[
    "Use Office settings for account, appearance, security and device controls; never share your password or OTP.",
    "If a module is missing, request scoped access instead of trying another employee's account.",
    "If locked out, request controlled recovery through /office/recover. Founder recovery is separate.",
    "Treat an unknown device, credential request, unexpected role change or data exposure as a security incident.",
  ]},
  {id:"exit",title:"8. Handover and offboarding",steps:[
    "Before transfer or exit, update open tasks, requests and assigned project evidence and hand over to an authorised successor.",
    "Return company assets and close actual attendance sessions. HR and Access administration govern the formal leaver process.",
    "Sign out of shared devices. Do not delete audit evidence or assume that closing a task revokes your account.",
  ]},
];

export function manualKey(id:string) {
  if(id==="common")return "COMMON";
  if(!roleById(id))throw new Error("Unknown role manual");
  return "ROLE:"+id.toUpperCase();
}

export function manualPublicUrl() {
  return "https://www.kraviaprivatelimited.com/office/quick-start";
}
