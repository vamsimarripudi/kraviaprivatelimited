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
