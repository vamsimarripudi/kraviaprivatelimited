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
export type LeadStage = 'NEW' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'DEMO_COMPLETED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'WON' | 'LOST' | 'ARCHIVED';
export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SalesLeadRecord {
  id: string;
  leadName: string;
  organizationName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  productInterest: string;
  leadSource?: string;
  stage: LeadStage;
  priority: LeadPriority;
  assignedPerson?: string;
  lastContactedDate?: string;
  nextFollowUpDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  followUpDue: boolean;
  daysUntilFollowUp?: number;
}

export interface SalesLeadRequest {
  leadName: string;
  organizationName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  productInterest: string;
  leadSource?: string;
  stage: LeadStage;
  priority: LeadPriority;
  assignedPerson?: string;
  lastContactedDate?: string;
  nextFollowUpDate?: string;
  notes?: string;
}

export interface SalesCustomerRecord {
  id: string;
  customerName: string;
  organizationType?: string;
  product: string;
  plan?: string;
  subscriptionStatus?: string;
  startDate?: string;
  renewalDate?: string;
  paymentStatus?: string;
  supportStatus?: string;
  onboardingStatus?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface SalesCustomerRequest {
  customerName: string;
  organizationType?: string;
  product: string;
  plan?: string;
  subscriptionStatus?: string;
  startDate?: string;
  renewalDate?: string;
  paymentStatus?: string;
  supportStatus?: string;
  onboardingStatus?: string;
  notes?: string;
}
export type EcosystemProductStatus = 'IDEA' | 'DEVELOPMENT' | 'TESTING' | 'STAGING' | 'LAUNCH_READY' | 'LIVE' | 'PAUSED' | 'ARCHIVED';

export interface EcosystemProductRecord {
  id: string;
  productName: string;
  productCode: string;
  status: EcosystemProductStatus;
  owner: string;
  description?: string;
  domain?: string;
  backendUrl?: string;
  frontendUrl?: string;
  currentVersion?: string;
  launchStatus?: string;
  revenueStatus?: string;
  complianceStatus?: string;
  securityStatus?: string;
  deploymentStatus?: string;
  healthNotes?: string;
  revenueNotes?: string;
  roadmapNotes?: string;
  launchChecklist?: string;
  riskRegister?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface EcosystemProductRequest {
  productName: string;
  productCode: string;
  status: EcosystemProductStatus;
  owner: string;
  description?: string;
  domain?: string;
  backendUrl?: string;
  frontendUrl?: string;
  currentVersion?: string;
  launchStatus?: string;
  revenueStatus?: string;
  complianceStatus?: string;
  securityStatus?: string;
  deploymentStatus?: string;
  healthNotes?: string;
  revenueNotes?: string;
  roadmapNotes?: string;
  launchChecklist?: string;
  riskRegister?: string;
}

export interface EcosystemSummary {
  registeredProducts: number;
  activeProducts: number;
  launchReadyProducts: number;
  liveProducts: number;
  archivedProducts: number;
  healthTrackedProducts: number;
  revenueVisibleProducts: number;
  complianceVisibleProducts: number;
  securityVisibleProducts: number;
  deploymentTrackedProducts: number;
  roadmapTrackedProducts: number;
  productsWithRisks: number;
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

export type PlatformEnvironmentType = 'DEVELOPMENT' | 'TESTING' | 'STAGING' | 'PRODUCTION' | 'DISASTER_RECOVERY';
export type PlatformOperationalStatus = 'ACTIVE' | 'DEGRADED' | 'DOWN' | 'MAINTENANCE' | 'UNKNOWN';
export type PlatformHealthState = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'NOT_CONFIGURED';
export type BackupType = 'DATABASE' | 'FILE' | 'CONFIGURATION';
export type BackupStatus = 'NOT_CONFIGURED' | 'SCHEDULED' | 'COMPLETED' | 'FAILED' | 'WARNING';
export type RestoreTestStatus = 'NOT_TESTED' | 'PASSED' | 'FAILED' | 'SCHEDULED';
export type PlatformJobStatus = 'ENABLED' | 'DISABLED' | 'RUNNING' | 'FAILED' | 'NOT_CONFIGURED';
export type ApiRegistryStatus = 'ACTIVE' | 'DEPRECATED' | 'DISABLED' | 'UNKNOWN';
export type RollbackStatus = 'NOT_REQUIRED' | 'AVAILABLE' | 'TESTED' | 'BLOCKED' | 'UNKNOWN';

export interface PlatformMetric { label: string; value: string; }
export interface PlatformHealthComponent { name: string; health: PlatformHealthState; detail: string; }
export interface PlatformModuleDependency { module: string; dependsOn: string[]; }
export interface PlatformSecurityCenter { failedLoginAttempts: number; lockedAccounts: number; activeUsers: number; recentSecurityEvents: string[]; }

export interface PlatformEnvironmentRecord { id: string; name: string; environmentType: PlatformEnvironmentType; url?: string; version?: string; buildNumber?: string; deploymentDate?: string; status: PlatformOperationalStatus; health: PlatformHealthState; region?: string; updatedAt: string; }
export interface PlatformServiceRecord { id: string; serviceName: string; version?: string; status: PlatformOperationalStatus; health: PlatformHealthState; apiBaseUrl?: string; owner?: string; lastDeployment?: string; dependencies?: string; updatedAt: string; }
export interface PlatformReleaseRecord { id: string; version: string; releaseName: string; releaseDate?: string; modulesIncluded?: string; breakingChanges?: string; databaseMigrationVersion?: string; rollbackStatus: RollbackStatus; updatedAt: string; }
export interface PlatformBackupRecord { id: string; backupType: BackupType; lastBackupAt?: string; nextScheduledBackupAt?: string; backupStatus: BackupStatus; backupSizeBytes?: number; restoreTestStatus: RestoreTestStatus; notes?: string; updatedAt: string; }
export interface PlatformJobRecord { id: string; jobName: string; jobType: string; status: PlatformJobStatus; lastRunAt?: string; nextRunAt?: string; owner?: string; notes?: string; updatedAt: string; }
export interface PlatformApiRecord { id: string; apiName: string; basePath: string; endpointCount: number; version?: string; authenticationRequired: boolean; status: ApiRegistryStatus; averageResponseTimeMs?: number; updatedAt: string; }

export interface PlatformOverview {
  engineeringMetrics: PlatformMetric[];
  health: PlatformHealthComponent[];
  environments: PlatformEnvironmentRecord[];
  services: PlatformServiceRecord[];
  releases: PlatformReleaseRecord[];
  backups: PlatformBackupRecord[];
  jobs: PlatformJobRecord[];
  apis: PlatformApiRecord[];
  moduleDependencies: PlatformModuleDependency[];
  securityCenter: PlatformSecurityCenter;
}
export type FinanceAccountType = 'ASSETS' | 'LIABILITIES' | 'EQUITY' | 'INCOME' | 'EXPENSES' | 'OTHER_INCOME' | 'OTHER_EXPENSES';
export type FinanceRecordStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type JournalApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'ARCHIVED';
export type TransactionType = 'DEBIT' | 'CREDIT';
export type ReconciliationStatus = 'UNRECONCILED' | 'RECONCILED' | 'REVIEW_REQUIRED' | 'ARCHIVED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'ARCHIVED';
export type ReceivableStatus = 'OPEN' | 'PARTIAL' | 'RECEIVED' | 'OVERDUE' | 'WRITTEN_OFF' | 'ARCHIVED';
export type PaymentStatus = 'PENDING' | 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'ARCHIVED';
export type GstFilingStatus = 'DRAFT' | 'READY' | 'FILED' | 'OVERDUE' | 'NOT_APPLICABLE' | 'ARCHIVED';
export type BudgetType = 'ANNUAL' | 'DEPARTMENT' | 'PRODUCT';
export type BudgetStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type FinancialApprovalType = 'LARGE_EXPENSE' | 'VENDOR_PAYMENT' | 'BUDGET_CHANGE' | 'JOURNAL_ENTRY';
export type FinancialApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ARCHIVED';
export type FinanceReportType = 'TRIAL_BALANCE' | 'BALANCE_SHEET' | 'PROFIT_LOSS' | 'CASH_FLOW' | 'GST_SUMMARY' | 'RECEIVABLES_AGING' | 'PAYABLES_AGING' | 'BUDGET_VARIANCE' | 'BANK_RECONCILIATION_SUMMARY';

export interface FinanceMetric { label: string; value: number; tone: string; }
export interface FinanceCountMetric { label: string; value: number; tone: string; }
export interface FinanceErpSummary { cashPosition: number; bankBalances: number; monthlyRevenue: number; monthlyExpenses: number; profitOrLoss: number; accountsReceivable: number; accountsPayable: number; upcomingPayments: number; upcomingReceipts: number; gstSummary: number; financialHealthIndicators: FinanceMetric[]; }
export interface FinanceAccountRecord { id: string; accountCode: string; accountName: string; accountType: FinanceAccountType; parentAccountId?: string; parentAccountName?: string; status: FinanceRecordStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface FinanceAccountRequest { accountCode: string; accountName: string; accountType: FinanceAccountType; parentAccountId?: string; status: FinanceRecordStatus; }
export interface JournalLineRequest { accountId: string; debit: number; credit: number; narration?: string; }
export interface JournalLineRecord extends JournalLineRequest { id: string; accountCode: string; accountName: string; }
export interface JournalEntryRecord { id: string; voucherNumber: string; postingDate: string; narration: string; approvalStatus: JournalApprovalStatus; linkedDocumentId?: string; createdBy: string; postedAt?: string; createdAt: string; updatedAt: string; archivedAt?: string; totalDebit: number; totalCredit: number; lines: JournalLineRecord[]; }
export interface JournalEntryRequest { voucherNumber: string; postingDate: string; narration: string; approvalStatus: JournalApprovalStatus; linkedDocumentId?: string; lines: JournalLineRequest[]; }
export interface BankAccountRecord { id: string; bankName: string; accountName: string; accountNumberMasked: string; ifscCode?: string; branch?: string; currentBalance: number; status: FinanceRecordStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface BankAccountRequest { bankName: string; accountName: string; accountNumberMasked: string; ifscCode?: string; branch?: string; currentBalance: number; status: FinanceRecordStatus; }
export interface BankTransactionRecord { id: string; bankAccountId: string; bankName: string; accountName: string; transactionDate: string; description: string; amount: number; transactionType: TransactionType; reconciliationStatus: ReconciliationStatus; linkedJournalEntryId?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface BankTransactionRequest { bankAccountId: string; transactionDate: string; description: string; amount: number; transactionType: TransactionType; reconciliationStatus: ReconciliationStatus; linkedJournalEntryId?: string; }
export interface InvoiceRecord { id: string; invoiceNumber: string; customerName: string; invoiceDate: string; dueDate: string; totalAmount: number; outstandingAmount: number; status: InvoiceStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface InvoiceRequest { invoiceNumber: string; customerName: string; invoiceDate: string; dueDate: string; totalAmount: number; outstandingAmount: number; status: InvoiceStatus; }
export interface ReceivableRecord { id: string; customerName: string; invoiceId?: string; invoiceNumber?: string; dueDate: string; outstandingAmount: number; status: ReceivableStatus; reminderStatus?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface ReceivableRequest { customerName: string; invoiceId?: string; dueDate: string; outstandingAmount: number; status: ReceivableStatus; reminderStatus?: string; }
export interface PayableRecord { id: string; vendorName: string; billNumber: string; dueDate: string; amount: number; paymentStatus: PaymentStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface PayableRequest { vendorName: string; billNumber: string; dueDate: string; amount: number; paymentStatus: PaymentStatus; }
export interface GstRecordErp { id: string; filingPeriod: string; gstCollected: number; gstPaid: number; inputTaxCredit: number; outputTax: number; netGstPosition: number; filingStatus: GstFilingStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface GstRecordRequest { filingPeriod: string; gstCollected: number; gstPaid: number; inputTaxCredit: number; outputTax: number; filingStatus: GstFilingStatus; }
export interface BudgetLineRequest { accountId?: string; lineName: string; plannedAmount: number; actualAmount: number; }
export interface BudgetLineRecord extends BudgetLineRequest { id: string; accountCode?: string; varianceAmount: number; }
export interface BudgetRecord { id: string; budgetName: string; budgetType: BudgetType; financialYear: string; department?: string; product?: string; annualBudget: number; status: BudgetStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; lines: BudgetLineRecord[]; }
export interface BudgetRequest { budgetName: string; budgetType: BudgetType; financialYear: string; department?: string; product?: string; annualBudget: number; status: BudgetStatus; lines: BudgetLineRequest[]; }
export interface FinancialApprovalRecord { id: string; approvalType: FinancialApprovalType; title: string; amount: number; status: FinancialApprovalStatus; requestedBy: string; approver?: string; approvalNotes?: string; approvalDate?: string; linkedRecordType?: string; linkedRecordId?: string; rejectionReason?: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface FinancialApprovalRequest { approvalType: FinancialApprovalType; title: string; amount: number; status: FinancialApprovalStatus; approver?: string; approvalNotes?: string; approvalDate?: string; linkedRecordType?: string; linkedRecordId?: string; rejectionReason?: string; }
export interface FinanceErpReport { reportType: string; generatedAt: string; metrics: FinanceMetric[]; counts: FinanceCountMetric[]; notes: string[]; }
export type VendorCategory = 'SOFTWARE' | 'CLOUD' | 'LEGAL' | 'COMPLIANCE' | 'BANKING' | 'DESIGN' | 'DEVELOPMENT' | 'MARKETING' | 'OFFICE' | 'OTHER';
export type ProcurementStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'UNPAID' | 'OVERDUE' | 'CANCELLED' | 'ARCHIVED';
export type ProcurementPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProcurementReportType = 'VENDOR_SUMMARY' | 'PURCHASE_REQUESTS' | 'PURCHASE_ORDERS' | 'VENDOR_BILLS' | 'SUBSCRIPTIONS' | 'APPROVALS' | 'OVERDUE_PAYMENTS';

export interface ProcurementMetric { label: string; value: number; tone: string; }
export interface ProcurementSummary { activeVendors: number; pendingPurchaseRequests: number; approvedPurchaseOrders: number; unpaidVendorBills: number; upcomingSubscriptionRenewals: number; overduePayments: number; metrics: ProcurementMetric[]; }
export interface ProcurementVendorRecord { id: string; vendorName: string; category: VendorCategory; contactPerson?: string; phone?: string; email?: string; gstin?: string; pan?: string; address?: string; serviceType?: string; status: ProcurementStatus; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface ProcurementVendorRequest { vendorName: string; category: VendorCategory; contactPerson?: string; phone?: string; email?: string; gstin?: string; pan?: string; address?: string; serviceType?: string; status: ProcurementStatus; notes?: string; }
export interface PurchaseRequestRecord { id: string; requestTitle: string; vendorId?: string; vendorName?: string; purpose: string; estimatedAmount: number; priority: ProcurementPriority; requestedBy: string; requiredDate?: string; status: ProcurementStatus; approvalStatus: ProcurementStatus; notes?: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface PurchaseRequestPayload { requestTitle: string; vendorId?: string; purpose: string; estimatedAmount: number; priority: ProcurementPriority; requestedBy?: string; requiredDate?: string; status: ProcurementStatus; approvalStatus: ProcurementStatus; notes?: string; }
export interface PurchaseOrderRecord { id: string; poNumber: string; vendorId: string; vendorName?: string; itemsOrServices: string; amount: number; taxes: number; totalAmount: number; issueDate: string; dueDate?: string; status: ProcurementStatus; linkedDocumentId?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface PurchaseOrderPayload { poNumber: string; vendorId: string; itemsOrServices: string; amount: number; taxes: number; issueDate: string; dueDate?: string; status: ProcurementStatus; linkedDocumentId?: string; }
export interface VendorBillRecord { id: string; billNumber: string; vendorId: string; vendorName?: string; billDate: string; dueDate: string; amount: number; gst: number; totalAmount: number; paymentStatus: ProcurementStatus; linkedPurchaseOrderId?: string; linkedDocumentId?: string; linkedFinancePayableId?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface VendorBillPayload { billNumber: string; vendorId: string; billDate: string; dueDate: string; amount: number; gst: number; paymentStatus: ProcurementStatus; linkedPurchaseOrderId?: string; linkedDocumentId?: string; linkedFinancePayableId?: string; }
export interface ProcurementSubscriptionRecord { id: string; serviceName: string; vendorId?: string; vendorName?: string; plan?: string; billingCycle?: string; amount: number; renewalDate?: string; autoRenewalEnabled: boolean; owner?: string; status: ProcurementStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface ProcurementSubscriptionPayload { serviceName: string; vendorId?: string; plan?: string; billingCycle?: string; amount: number; renewalDate?: string; autoRenewalEnabled: boolean; owner?: string; status: ProcurementStatus; }
export interface ProcurementApprovalRecord { id: string; approvalTitle: string; approvalType: string; status: ProcurementStatus; approver?: string; approvalNotes?: string; approvalDate?: string; rejectionReason?: string; linkedRecordType?: string; linkedRecordId?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface ProcurementApprovalPayload { approvalTitle: string; approvalType: string; status: ProcurementStatus; approver?: string; approvalNotes?: string; approvalDate?: string; rejectionReason?: string; linkedRecordType?: string; linkedRecordId?: string; }
export interface VendorDocumentRecord { id: string; vendorId: string; vendorName?: string; documentId: string; documentTitle?: string; documentPurpose?: string; status: ProcurementStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface VendorDocumentPayload { vendorId: string; documentId: string; documentPurpose?: string; status: ProcurementStatus; }
export interface ProcurementReport { reportType: string; generatedAt: string; metrics: ProcurementMetric[]; notes: string[]; }
export type AssetCategory = 'LAPTOP' | 'MOBILE' | 'SERVER' | 'CLOUD_RESOURCE' | 'SOFTWARE_LICENSE' | 'DOMAIN' | 'SSL_CERTIFICATE' | 'OFFICE_EQUIPMENT' | 'FURNITURE' | 'NETWORK_DEVICE' | 'OTHER';
export type AssetStatus = 'ACTIVE' | 'ASSIGNED' | 'UNASSIGNED' | 'UNDER_MAINTENANCE' | 'EXPIRED' | 'LOST' | 'SOLD' | 'RETIRED' | 'ARCHIVED';
export type AssetReportType = 'ASSET_REGISTER' | 'ASSIGNMENTS' | 'MAINTENANCE' | 'SOFTWARE_LICENSES' | 'CLOUD_RESOURCES' | 'DEPRECIATION' | 'WARRANTY_EXPIRY' | 'DOCUMENT_LINKS';
export interface AssetMetric { label: string; value: number; tone: string; }
export interface AssetSummary { totalAssets: number; assignedAssets: number; unassignedAssets: number; expiringLicenses: number; warrantyExpiring: number; assetsUnderMaintenance: number; metrics: AssetMetric[]; }
export interface AssetRecord { id: string; assetName: string; assetCode: string; category: AssetCategory; description?: string; purchaseDate?: string; purchaseCost: number; vendorId?: string; vendorName?: string; assignedTo?: string; location?: string; status: AssetStatus; warrantyStartDate?: string; warrantyEndDate?: string; renewalDate?: string; relatedDocumentId?: string; relatedDocumentTitle?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface AssetRequestPayload { assetName: string; assetCode: string; category: AssetCategory; description?: string; purchaseDate?: string; purchaseCost?: number; vendorId?: string; assignedTo?: string; location?: string; status: AssetStatus; warrantyStartDate?: string; warrantyEndDate?: string; renewalDate?: string; relatedDocumentId?: string; notes?: string; }
export interface AssetAssignmentRecord { id: string; assetId: string; assetName?: string; assetCode?: string; assignedTo: string; assignedBy: string; assignedDate: string; returnDate?: string; location?: string; status: AssetStatus; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface AssetAssignmentPayload { assetId: string; assignedTo: string; assignedBy?: string; assignedDate: string; returnDate?: string; location?: string; status: AssetStatus; notes?: string; }
export interface AssetMaintenanceRecord { id: string; assetId: string; assetName?: string; assetCode?: string; maintenanceTitle: string; maintenanceType?: string; serviceProvider?: string; maintenanceDate: string; nextMaintenanceDate?: string; cost: number; status: AssetStatus; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface AssetMaintenancePayload { assetId: string; maintenanceTitle: string; maintenanceType?: string; serviceProvider?: string; maintenanceDate: string; nextMaintenanceDate?: string; cost?: number; status: AssetStatus; notes?: string; }
export interface SoftwareLicenseRecord { id: string; assetId?: string; assetName?: string; licenseName: string; provider?: string; licenseKeyReference?: string; seats?: number; assignedSeats?: number; renewalDate?: string; status: AssetStatus; relatedDocumentId?: string; relatedDocumentTitle?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface SoftwareLicensePayload { assetId?: string; licenseName: string; provider?: string; licenseKeyReference?: string; seats?: number; assignedSeats?: number; renewalDate?: string; status: AssetStatus; relatedDocumentId?: string; notes?: string; }
export interface CloudResourceRecord { id: string; assetId?: string; assetName?: string; resourceName: string; provider?: string; resourceType?: string; region?: string; environment?: string; monthlyCost: number; owner?: string; status: AssetStatus; relatedDocumentId?: string; relatedDocumentTitle?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface CloudResourcePayload { assetId?: string; resourceName: string; provider?: string; resourceType?: string; region?: string; environment?: string; monthlyCost?: number; owner?: string; status: AssetStatus; relatedDocumentId?: string; notes?: string; }
export interface AssetDocumentRecord { id: string; assetId: string; assetName?: string; assetCode?: string; documentId: string; documentTitle?: string; documentPurpose?: string; status: AssetStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface AssetDocumentPayload { assetId: string; documentId: string; documentPurpose?: string; status: AssetStatus; }
export interface AssetReport { reportType: string; generatedAt: string; metrics: AssetMetric[]; notes: string[]; }

export type OrganizationLevel = 'FOUNDER' | 'BOARD_OF_DIRECTORS' | 'EXECUTIVE_LEADERSHIP' | 'DEPARTMENT_HEADS' | 'TEAM_LEADS' | 'EMPLOYEES' | 'INTERNS' | 'CONTRACTORS' | 'ADVISORS';
export type EmploymentType = 'FOUNDER' | 'DIRECTOR' | 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'CONSULTANT' | 'ADVISOR' | 'INTERN';
export type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED' | 'RETIRED' | 'ARCHIVED';
export type ProbationStatus = 'NOT_APPLICABLE' | 'IN_PROGRESS' | 'CONFIRMED' | 'EXTENDED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'WFH' | 'HOLIDAY' | 'HALF_DAY';
export type LeaveType = 'CASUAL_LEAVE' | 'SICK_LEAVE' | 'EARNED_LEAVE' | 'WORK_FROM_HOME' | 'COMPENSATORY_OFF' | 'MATERNITY_LEAVE' | 'PATERNITY_LEAVE' | 'UNPAID_LEAVE';
export type LeaveStatus = 'REQUESTED' | 'MANAGER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ARCHIVED';
export type PayrollStatus = 'DRAFT' | 'FINAL' | 'PAID' | 'ARCHIVED';
export type PerformanceRating = 'NOT_RATED' | 'EXCEEDS_EXPECTATIONS' | 'MEETS_EXPECTATIONS' | 'NEEDS_IMPROVEMENT' | 'UNSATISFACTORY';
export type TrainingStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'ARCHIVED';
export type ExitStatus = 'INITIATED' | 'IN_PROGRESS' | 'CLEARED' | 'FINAL_SETTLEMENT_PENDING' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type HrReportType = 'EMPLOYEE_DIRECTORY' | 'DEPARTMENT_SUMMARY' | 'LEAVE_REPORT' | 'ATTENDANCE_REPORT' | 'PAYROLL_SUMMARY' | 'PERFORMANCE_REPORT' | 'TRAINING_REPORT' | 'EXIT_REPORT';

export interface HrMetric { label: string; value: number; tone: string; }
export interface HrSummary { activeEmployees: number; departments: number; pendingLeaveRequests: number; todayAttendanceRecords: number; payrollRecords: number; openExitRecords: number; metrics: HrMetric[]; }
export interface DepartmentRecord { id: string; departmentName: string; description?: string; parentDepartmentId?: string; parentDepartmentName?: string; organizationLevel?: OrganizationLevel; headEmployeeId?: string; status: EmploymentStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface DepartmentRequest { departmentName: string; description?: string; parentDepartmentId?: string; organizationLevel?: OrganizationLevel; headEmployeeId?: string; status: EmploymentStatus; }
export interface DesignationRecord { id: string; title: string; departmentId?: string; departmentName?: string; organizationLevel?: OrganizationLevel; description?: string; status: EmploymentStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface DesignationRequest { title: string; departmentId?: string; organizationLevel?: OrganizationLevel; description?: string; status: EmploymentStatus; }
export interface EmployeeRecord { id: string; employeeId: string; fullName: string; preferredName?: string; profilePhotoDocumentId?: string; profilePhotoTitle?: string; email: string; phone?: string; emergencyContact?: string; departmentId?: string; departmentName?: string; designationId?: string; designationTitle?: string; reportingManagerId?: string; reportingManagerName?: string; employmentType: EmploymentType; dateOfJoining: string; probationStatus: ProbationStatus; workLocation?: string; employmentStatus: EmploymentStatus; skills?: string; certifications?: string; relatedDocumentId?: string; relatedDocumentTitle?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface EmployeeRequest { employeeId: string; fullName: string; preferredName?: string; profilePhotoDocumentId?: string; email: string; phone?: string; emergencyContact?: string; departmentId?: string; designationId?: string; reportingManagerId?: string; employmentType: EmploymentType; dateOfJoining: string; probationStatus: ProbationStatus; workLocation?: string; employmentStatus: EmploymentStatus; skills?: string; certifications?: string; relatedDocumentId?: string; notes?: string; }
export interface EmployeeContactRecord { id: string; employeeId: string; employeeName?: string; contactType: string; contactName: string; relationship?: string; phone?: string; email?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface EmployeeContactRequest { employeeId: string; contactType: string; contactName: string; relationship?: string; phone?: string; email?: string; notes?: string; }
export interface AttendanceRecord { id: string; employeeId: string; employeeName?: string; attendanceDate: string; status: AttendanceStatus; workLocation?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface AttendanceRequest { employeeId: string; attendanceDate: string; status: AttendanceStatus; workLocation?: string; notes?: string; }
export interface LeaveRecord { id: string; employeeId: string; employeeName?: string; leaveType: LeaveType; startDate: string; endDate: string; totalDays: number; status: LeaveStatus; managerId?: string; managerName?: string; approvalNotes?: string; relatedTaskId?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface LeaveRequestPayload { employeeId: string; leaveType: LeaveType; startDate: string; endDate: string; totalDays: number; status: LeaveStatus; managerId?: string; approvalNotes?: string; relatedTaskId?: string; }
export interface HolidayRecord { id: string; holidayName: string; holidayDate: string; description?: string; status: EmploymentStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface HolidayRequest { holidayName: string; holidayDate: string; description?: string; status: EmploymentStatus; }
export interface PayrollRecord { id: string; employeeId: string; employeeName?: string; payrollMonth: string; salaryStructure?: string; basicSalary: number; allowances: number; deductions: number; pf: number; esi: number; professionalTax: number; tds: number; netSalary: number; status: PayrollStatus; linkedFinancialRecordId?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface PayrollRequest { employeeId: string; payrollMonth: string; salaryStructure?: string; basicSalary: number; allowances?: number; deductions?: number; pf?: number; esi?: number; professionalTax?: number; tds?: number; status: PayrollStatus; linkedFinancialRecordId?: string; notes?: string; }
export interface PerformanceReviewRecord { id: string; employeeId: string; employeeName?: string; reviewCycle: string; goals?: string; achievements?: string; managerFeedback?: string; employeeFeedback?: string; rating: PerformanceRating; improvementPlan?: string; reviewDate: string; reviewerId?: string; reviewerName?: string; relatedTaskId?: string; status: EmploymentStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface PerformanceReviewRequest { employeeId: string; reviewCycle: string; goals?: string; achievements?: string; managerFeedback?: string; employeeFeedback?: string; rating: PerformanceRating; improvementPlan?: string; reviewDate: string; reviewerId?: string; relatedTaskId?: string; status: EmploymentStatus; }
export interface TrainingRecord { id: string; trainingName: string; provider?: string; completionDate?: string; expiryDate?: string; certificateDocumentId?: string; certificateDocumentTitle?: string; skillsCovered?: string; status: TrainingStatus; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface TrainingRequest { trainingName: string; provider?: string; completionDate?: string; expiryDate?: string; certificateDocumentId?: string; skillsCovered?: string; status: TrainingStatus; notes?: string; }
export interface CertificationRecord { id: string; employeeId: string; employeeName?: string; trainingId?: string; trainingName?: string; certificationName: string; provider?: string; issueDate?: string; expiryDate?: string; certificateDocumentId?: string; certificateDocumentTitle?: string; skillsCovered?: string; status: TrainingStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface CertificationRequest { employeeId: string; trainingId?: string; certificationName: string; provider?: string; issueDate?: string; expiryDate?: string; certificateDocumentId?: string; skillsCovered?: string; status: TrainingStatus; }
export interface ExitRecord { id: string; employeeId: string; employeeName?: string; resignationDate?: string; lastWorkingDay?: string; reason?: string; exitChecklist?: string; assetReturnStatus?: string; finalSettlementStatus?: string; knowledgeTransferStatus?: string; exitInterviewNotes?: string; relatedDocumentId?: string; relatedDocumentTitle?: string; status: ExitStatus; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface ExitRequestPayload { employeeId: string; resignationDate?: string; lastWorkingDay?: string; reason?: string; exitChecklist?: string; assetReturnStatus?: string; finalSettlementStatus?: string; knowledgeTransferStatus?: string; exitInterviewNotes?: string; relatedDocumentId?: string; status: ExitStatus; }
export interface HrReport { reportType: HrReportType; generatedAt: string; metrics: HrMetric[]; notes: string[]; }
export type ContractType = 'FOUNDER_AGREEMENT' | 'CO_FOUNDER_AGREEMENT' | 'SHAREHOLDER_AGREEMENT' | 'VENDOR_AGREEMENT' | 'CUSTOMER_AGREEMENT' | 'NDA' | 'EMPLOYMENT_AGREEMENT' | 'CONSULTANT_AGREEMENT' | 'RENT_AGREEMENT' | 'BANK_AGREEMENT' | 'SERVICE_AGREEMENT' | 'OTHER';
export type LegalStatus = 'DRAFT' | 'UNDER_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'SIGNED' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'ARCHIVED';
export type SignatureStatus = 'NOT_REQUIRED' | 'PENDING_SIGNATURE' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'DECLINED' | 'EXPIRED';
export type LegalPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type LegalRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type LegalReportType = 'CONTRACT_SUMMARY' | 'OBLIGATION_SUMMARY' | 'RENEWAL_TRACKER' | 'APPROVAL_SUMMARY' | 'NOTICE_SUMMARY' | 'RISK_SUMMARY';

export interface LegalMetric { label: string; value: number; tone: string; }
export interface LegalSummary { activeContracts: number; contractsUnderReview: number; pendingSignatures: number; upcomingRenewals: number; expiringAgreements: number; legalRisks: number; metrics: LegalMetric[]; }
export interface LegalContractRecord { id: string; contractTitle: string; contractType: ContractType; partiesInvolved?: string; effectiveDate?: string; expiryDate?: string; renewalDate?: string; contractValue: number; status: LegalStatus; approvalStatus: LegalStatus; signatureStatus: SignatureStatus; relatedDocumentId?: string; relatedDocumentTitle?: string; responsiblePerson?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface LegalContractRequest { contractTitle: string; contractType: ContractType; partiesInvolved?: string; effectiveDate?: string; expiryDate?: string; renewalDate?: string; contractValue?: number; status: LegalStatus; approvalStatus: LegalStatus; signatureStatus: SignatureStatus; relatedDocumentId?: string; responsiblePerson?: string; notes?: string; }
export interface LegalObligationRecord { id: string; contractId?: string; contractTitle?: string; obligationTitle: string; description?: string; responsiblePerson: string; dueDate?: string; status: LegalStatus; priority: LegalPriority; relatedDocumentId?: string; relatedDocumentTitle?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface LegalObligationRequest { contractId?: string; obligationTitle: string; description?: string; responsiblePerson: string; dueDate?: string; status: LegalStatus; priority: LegalPriority; relatedDocumentId?: string; notes?: string; }
export interface LegalApprovalRecord { id: string; contractId?: string; contractTitle?: string; approvalTitle: string; approvalStatus: LegalStatus; approver?: string; approvalNotes?: string; approvalDate?: string; rejectionReason?: string; relatedDocumentId?: string; relatedDocumentTitle?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface LegalApprovalRequest { contractId?: string; approvalTitle: string; approvalStatus: LegalStatus; approver?: string; approvalNotes?: string; approvalDate?: string; rejectionReason?: string; relatedDocumentId?: string; notes?: string; }
export interface LegalNoticeRecord { id: string; noticeTitle: string; noticeType?: string; issuedBy?: string; issuedTo: string; noticeDate: string; responseDueDate?: string; status: LegalStatus; relatedDocumentId?: string; relatedDocumentTitle?: string; responsiblePerson?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface LegalNoticeRequest { noticeTitle: string; noticeType?: string; issuedBy?: string; issuedTo: string; noticeDate: string; responseDueDate?: string; status: LegalStatus; relatedDocumentId?: string; responsiblePerson?: string; notes?: string; }
export interface LegalRiskRecord { id: string; contractId?: string; contractTitle?: string; riskRegisterEntryId?: string; riskRegisterTitle?: string; riskTitle: string; severity: LegalRiskSeverity; status: LegalStatus; owner?: string; mitigationPlan?: string; reviewDate?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; archivedAt?: string; }
export interface LegalRiskRequest { contractId?: string; riskRegisterEntryId?: string; riskTitle: string; severity: LegalRiskSeverity; status: LegalStatus; owner?: string; mitigationPlan?: string; reviewDate?: string; notes?: string; }
export interface LegalReport { reportType: LegalReportType; generatedAt: string; metrics: LegalMetric[]; notes: string[]; }
export type AnalyticsModule = 'EXECUTIVE' | 'FINANCE' | 'SALES' | 'PRODUCTS' | 'COMPLIANCE' | 'HR' | 'LEGAL' | 'PROCUREMENT' | 'OPERATIONS';
export type AnalyticsExportFormat = 'PDF' | 'EXCEL' | 'CSV';
export interface AnalyticsMetric { label: string; value: number; unit: string; tone: string; }
export interface AnalyticsTrendPoint { label: string; value: number; tone: string; }
export interface AnalyticsRiskIndicator { label: string; value: number; severity: string; description: string; }
export interface AnalyticsDataset { title: string; metrics: AnalyticsMetric[]; trends: AnalyticsTrendPoint[]; risks: AnalyticsRiskIndicator[]; notes: string[]; }
export interface AnalyticsDashboard { module: AnalyticsModule; generatedAt: string; from?: string; to?: string; kpis: AnalyticsMetric[]; sections: AnalyticsDataset[]; risks: AnalyticsRiskIndicator[]; emptyStates: string[]; }
export interface AnalyticsExportRequest { module: AnalyticsModule; format: AnalyticsExportFormat; from?: string; to?: string; }
export interface AnalyticsExportResponse { module: AnalyticsModule; format: AnalyticsExportFormat; requestedAt: string; status: string; message: string; }
