export interface CompanyProfile {
  id?: string;
  companyName?: string;
  cin?: string;
  pan?: string;
  tan?: string;
  registeredOfficeAddress?: string;
  email?: string;
  phone?: string;
  dateOfIncorporation?: string;
  authorizedCapital?: string;
  paidUpCapital?: string;
  directors?: string;
  shareholders?: string;
  companyStatus?: string;
  lastUpdatedDate?: string;
}

export type DocumentCategory =
  | 'INCORPORATION_CERTIFICATE'
  | 'MOA'
  | 'AOA'
  | 'COMPANY_PAN'
  | 'TAN'
  | 'GST'
  | 'BOARD_RESOLUTION'
  | 'RENTAL_AGREEMENT'
  | 'BANK_DOCUMENT'
  | 'TRADEMARK_DOCUMENT'
  | 'STARTUP_INDIA_DOCUMENT'
  | 'AGREEMENT'
  | 'OTHER';

export type DocumentStatus = 'ACTIVE' | 'ARCHIVED' | 'EXPIRED' | 'PENDING_REVIEW';

export interface DocumentRecord {
  id: string;
  title: string;
  category: DocumentCategory;
  description?: string;
  status: DocumentStatus;
  fileName: string;
  fileType: string;
  fileSize: number;
  version: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface DocumentMetadataRequest {
  title: string;
  category: DocumentCategory;
  description?: string;
  status: DocumentStatus;
}


export type MeetingType =
  | 'BOARD_MEETING'
  | 'FOUNDER_MEETING'
  | 'FINANCE_REVIEW'
  | 'COMPLIANCE_REVIEW'
  | 'PRODUCT_REVIEW'
  | 'BANK_MEETING'
  | 'INVESTOR_MEETING'
  | 'OTHER';

export type MeetingStatus = 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'ARCHIVED';

export type MeetingActionItemStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'DONE' | 'BLOCKED';

export interface MeetingActionItemRecord {
  id: string;
  actionText: string;
  owner: string;
  dueDate?: string;
  status: MeetingActionItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingActionItemRequest {
  actionText: string;
  owner: string;
  dueDate?: string;
  status: MeetingActionItemStatus;
}

export interface BoardMeetingRecord {
  id: string;
  title: string;
  meetingDate: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  agendaItems: string[];
  discussionNotes?: string;
  decisions: string[];
  resolutions: string[];
  actionItems: MeetingActionItemRecord[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface BoardMeetingRequest {
  title: string;
  meetingDate: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  agendaItems: string[];
  discussionNotes?: string;
  decisions: string[];
  resolutions: string[];
  actionItems?: MeetingActionItemRequest[];
}


export type FinancialRecordStatus = 'DRAFT' | 'FINAL' | 'ARCHIVED';

export interface FinancialRecord {
  id: string;
  reportingMonth: string;
  revenue: number;
  expenses: number;
  profitOrLoss: number;
  cashBalance: number;
  receivables: number;
  payables: number;
  gstCollected: number;
  gstPaid: number;
  netGstPosition: number;
  cloudSubscriptions: number;
  vendorPayments: number;
  directorRemuneration: number;
  founderNotes?: string;
  status: FinancialRecordStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface FinancialRecordRequest {
  reportingMonth: string;
  revenue: number;
  expenses: number;
  cashBalance?: number;
  receivables?: number;
  payables?: number;
  gstCollected: number;
  gstPaid: number;
  cloudSubscriptions?: number;
  vendorPayments?: number;
  directorRemuneration?: number;
  founderNotes?: string;
  status: FinancialRecordStatus;
}

export type ComplianceCategory =
  | 'MCA'
  | 'ROC'
  | 'INC_22'
  | 'AUDITOR_APPOINTMENT'
  | 'GST_REGISTRATION'
  | 'GST_FILING'
  | 'STARTUP_INDIA'
  | 'TRADEMARK'
  | 'MSME_UDYAM'
  | 'EPFO'
  | 'ESIC'
  | 'BANK_KYC'
  | 'ANNUAL_COMPLIANCE'
  | 'BOARD_RESOLUTION'
  | 'LEGAL_AGREEMENT'
  | 'OTHER';

export type ComplianceStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CA'
  | 'WAITING_FOR_DIRECTOR'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'NOT_APPLICABLE'
  | 'ARCHIVED';

export type CompliancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ComplianceItem {
  id: string;
  title: string;
  category: ComplianceCategory;
  description?: string;
  dueDate?: string;
  status: ComplianceStatus;
  priority: CompliancePriority;
  responsiblePerson?: string;
  relatedDocumentId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  overdue: boolean;
  upcomingDue: boolean;
  daysUntilDue?: number;
}

export interface ComplianceItemRequest {
  title: string;
  category: ComplianceCategory;
  description?: string;
  dueDate?: string;
  status: ComplianceStatus;
  priority: CompliancePriority;
  responsiblePerson?: string;
  relatedDocumentId?: string;
  notes?: string;
}

export type TaskCategory =
  | 'FOUNDER_TASK'
  | 'DIRECTOR_TASK'
  | 'CA_TASK'
  | 'LAWYER_TASK'
  | 'BANK_TASK'
  | 'PRODUCT_TASK'
  | 'FINANCE_TASK'
  | 'COMPLIANCE_TASK'
  | 'DOCUMENT_TASK'
  | 'INVESTOR_TASK'
  | 'CUSTOMER_TASK'
  | 'OTHER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ARCHIVED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CompanyTask {
  id: string;
  title: string;
  category: TaskCategory;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  relatedSection?: string;
  relatedDocumentId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
  overdue: boolean;
  daysUntilDue?: number;
}

export interface CompanyTaskRequest {
  title: string;
  category: TaskCategory;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  relatedSection?: string;
  relatedDocumentId?: string;
  notes?: string;
}

export interface TaskStatusRequest { status: TaskStatus; }
export type ProductCategory = 'VIDYALUMA' | 'VAANMEET' | 'VFORMIX' | 'FUTURE_PRODUCT' | 'OTHER';

export type ProductStatus = 'IDEA' | 'PLANNING' | 'DESIGN' | 'DEVELOPMENT' | 'TESTING' | 'LAUNCH_READY' | 'LIVE' | 'PAUSED' | 'ARCHIVED';

export interface ProductRecord {
  id: string;
  name: string;
  category: ProductCategory;
  description?: string;
  status: ProductStatus;
  developmentStage: string;
  launchReadinessPercentage: number;
  targetUsers?: string;
  pricingNotes?: string;
  revenueNotes?: string;
  keyFeatures?: string;
  pendingWork?: string;
  risks?: string;
  nextMilestone?: string;
  responsiblePerson?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ProductRequest {
  name: string;
  category: ProductCategory;
  description?: string;
  status: ProductStatus;
  developmentStage: string;
  launchReadinessPercentage: number;
  targetUsers?: string;
  pricingNotes?: string;
  revenueNotes?: string;
  keyFeatures?: string;
  pendingWork?: string;
  risks?: string;
  nextMilestone?: string;
  responsiblePerson?: string;
}
export type ContactCategory = 'CA' | 'LAWYER' | 'BANK_MANAGER' | 'VENDOR' | 'INVESTOR' | 'GOVERNMENT_CONTACT' | 'CUSTOMER' | 'ADVISOR' | 'CONSULTANT' | 'OTHER';

export type ContactStatus = 'ACTIVE' | 'WAITING' | 'FOLLOW_UP_NEEDED' | 'CLOSED' | 'ARCHIVED';

export interface ContactRecord {
  id: string;
  name: string;
  organization?: string;
  role?: string;
  category: ContactCategory;
  phone?: string;
  email?: string;
  notes?: string;
  relatedDocumentId?: string;
  relatedTaskId?: string;
  lastContactedDate?: string;
  nextFollowUpDate?: string;
  status: ContactStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  followUpDue: boolean;
  daysUntilFollowUp?: number;
}

export interface ContactRequest {
  name: string;
  organization?: string;
  role?: string;
  category: ContactCategory;
  phone?: string;
  email?: string;
  notes?: string;
  relatedDocumentId?: string;
  relatedTaskId?: string;
  lastContactedDate?: string;
  nextFollowUpDate?: string;
  status: ContactStatus;
}
export type AnnouncementAudience = 'FOUNDER' | 'DIRECTOR' | 'VIEWER' | 'EVERYONE';

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'PINNED' | 'ARCHIVED' | 'EXPIRED';

export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  expiresAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  pinnedAt?: string;
  archivedAt?: string;
}

export interface AnnouncementRequest {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  expiresAt?: string;
}

export type NotificationType =
  | 'COMPLIANCE_DUE'
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  | 'MEETING_CREATED'
  | 'DOCUMENT_UPLOADED'
  | 'FINANCIAL_RECORD_ADDED'
  | 'PRODUCT_UPDATED'
  | 'SETTINGS_CHANGED'
  | 'SECURITY_ALERT'
  | 'GENERAL';

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  recipientEmail: string;
  audience: AnnouncementAudience;
  sourceModule?: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  archivedAt?: string;
  read: boolean;
}
export type AiModuleContext =
  | 'ALL'
  | 'COMPANY_PROFILE'
  | 'DOCUMENTS'
  | 'BOARD_MEETINGS'
  | 'FINANCE'
  | 'COMPLIANCE'
  | 'TASKS'
  | 'PRODUCTS'
  | 'CONTACTS'
  | 'ANNOUNCEMENTS';

export type AiOutputType =
  | 'SUMMARY'
  | 'EMAIL_DRAFT'
  | 'BOARD_RESOLUTION'
  | 'RISK_ANALYSIS'
  | 'ACTION_ITEMS'
  | 'GENERAL_ANSWER';

export interface AiDateRange {
  from?: string;
  to?: string;
}

export interface AiQueryRequest {
  query: string;
  module_context: AiModuleContext;
  date_range?: AiDateRange;
  output_type: AiOutputType;
}

export interface AiContextSnapshotRecord {
  id: string;
  moduleContext: string;
  snapshotText: string;
  createdAt: string;
}

export interface AiQueryRecord {
  id: string;
  query: string;
  module_context: AiModuleContext;
  output_type: AiOutputType;
  date_range: AiDateRange;
  response: string;
  createdBy: string;
  actorEmail: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  contextSnapshots: AiContextSnapshotRecord[];
}
export type ReportType =
  | 'company-summary'
  | 'financial-summary'
  | 'profit-loss'
  | 'board-meetings'
  | 'compliance'
  | 'tasks'
  | 'products'
  | 'documents'
  | 'contacts'
  | 'activity';

export interface ReportFilters {
  from?: string;
  to?: string;
  module?: string;
}

export interface ReportMetric {
  label: string;
  value: string;
  tone: 'neutral' | 'positive' | 'warning' | 'critical' | string;
}

export interface ReportSection {
  title: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface ReportResponse {
  key: ReportType;
  title: string;
  description: string;
  generatedAt: string;
  filters: ReportFilters;
  metrics: ReportMetric[];
  sections: ReportSection[];
  pdfExportAvailable: boolean;
  excelExportAvailable: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  status: string;
  route: string;
  updatedAt: string;
}

export interface SearchGroup {
  module: string;
  label: string;
  count: number;
  results: SearchResult[];
}

export interface SearchResponse {
  query: string;
  searchedAt: string;
  totalResults: number;
  groups: SearchGroup[];
}
export interface AuditLogRecord {
  id: string;
  actorEmail: string;
  actorName: string;
  actorRoles: string;
  module: string;
  action: string;
  description: string;
  severity: string;
  createdAt: string;
}

export interface ExecutiveDashboard {
  companyOverview: DashboardCompanyOverview;
  financialHighlights: DashboardFinancialHighlights;
  metrics: DashboardMetric[];
  pendingApprovals: DashboardItem[];
  complianceAlerts: DashboardItem[];
  upcomingMeetings: DashboardItem[];
  openTasks: DashboardItem[];
  productProgress: ProductProgressSummary;
  recentDocuments: DashboardItem[];
  notifications: DashboardItem[];
  aiInsights: string[];
}

export interface DashboardCompanyOverview {
  companyName?: string;
  companyStatus?: string;
  updatedAt?: string;
}

export interface DashboardFinancialHighlights {
  available: boolean;
  reportingMonth?: string;
  revenue?: number;
  expenses?: number;
  profitOrLoss?: number;
  cashBalance?: number;
  netGstPosition?: number;
}

export interface DashboardMetric {
  label: string;
  value: number;
}

export interface DashboardItem {
  id: string;
  module: string;
  title: string;
  status: string;
  dateLabel?: string;
}

export interface ProductProgressSummary {
  totalProducts: number;
  activeProducts: number;
  launchReadyProducts: number;
  productsWithRisks: number;
  averageLaunchReadiness: number;
}

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface DataPrivacyRecord {
  id: string;
  moduleName: string;
  recordId?: string;
  classification: DataClassification;
  sensitiveDocument: boolean;
  accessVisibility?: string;
  retentionRule?: string;
  exportRequestedAt?: string;
  deletionRequestedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataPrivacyRequest {
  moduleName: string;
  recordId?: string;
  classification: DataClassification;
  sensitiveDocument: boolean;
  accessVisibility?: string;
  retentionRule?: string;
}

export type ApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApprovalRecord {
  id: string;
  title: string;
  description?: string;
  status: ApprovalStatus;
  approver?: string;
  approvalNotes?: string;
  approvalDate?: string;
  rejectionReason?: string;
  linkedModule?: string;
  linkedRecordId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestPayload {
  title: string;
  description?: string;
  status: ApprovalStatus;
  approver?: string;
  approvalNotes?: string;
  rejectionReason?: string;
  linkedModule?: string;
  linkedRecordId?: string;
}

export interface ApprovalDecisionPayload {
  status: ApprovalStatus;
  approvalNotes?: string;
  rejectionReason?: string;
}

export type RiskCategory = 'LEGAL' | 'FINANCIAL' | 'COMPLIANCE' | 'SECURITY' | 'PRODUCT' | 'OPERATIONAL' | 'REPUTATION' | 'OTHER';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskStatus = 'OPEN' | 'MITIGATING' | 'MONITORING' | 'CLOSED' | 'ARCHIVED';

export interface RiskRecord {
  id: string;
  title: string;
  category: RiskCategory;
  description?: string;
  severity: RiskLevel;
  likelihood: RiskLevel;
  owner?: string;
  mitigationPlan?: string;
  status: RiskStatus;
  reviewDate?: string;
  relatedRecords?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskRequestPayload {
  title: string;
  category: RiskCategory;
  description?: string;
  severity: RiskLevel;
  likelihood: RiskLevel;
  owner?: string;
  mitigationPlan?: string;
  status: RiskStatus;
  reviewDate?: string;
  relatedRecords?: string;
}

export type EvidencePackType = 'BOARD_MEETINGS' | 'COMPLIANCE_FILINGS' | 'FINANCIAL_RECORDS' | 'DOCUMENT_VAULT' | 'USER_ACCESS' | 'AUDIT_LOGS';

export interface EvidencePackRecord {
  id: string;
  packType: EvidencePackType;
  title: string;
  status: 'GENERATED' | 'ARCHIVED';
  sourceSummary?: string;
  generatedBy: string;
  generatedAt: string;
  pdfExportAvailable: boolean;
  zipExportAvailable: boolean;
  excelExportAvailable: boolean;
}

export interface EvidenceTimelineItem {
  id: string;
  source: string;
  module: string;
  action: string;
  actor: string;
  description: string;
  timestamp: string;
}

export interface EvidencePackRequestPayload {
  packType: EvidencePackType;
  title?: string;
}

export type AccessReviewStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'NEEDS_CHANGE' | 'NOT_REQUIRED';

export interface AccessReviewRecord {
  userId: string;
  email: string;
  displayName: string;
  roles: string;
  enabled: boolean;
  lastLoginAt?: string;
  inactive: boolean;
  quarterLabel: string;
  reviewStatus: AccessReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface GovernanceMetric {
  label: string;
  value: number;
}

export interface GovernanceActivityItem {
  id: string;
  module: string;
  action: string;
  description: string;
  actor: string;
  timestamp: string;
}

export interface GovernanceDashboard {
  metrics: GovernanceMetric[];
  recentGovernanceActivity: GovernanceActivityItem[];
  accessReviewQuarter: string;
  accessReviewStatus: string;
  complianceEvidenceStatus: string;
}
