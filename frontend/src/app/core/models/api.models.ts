export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface WorkspaceRecord {
  id: string;
  title: string;
  status: string;
  ownerName?: string;
  dueDate?: string;
  category?: string;
  referenceCode?: string;
  amount?: number;
  details?: string;
  notes?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

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

export interface DocumentRecord {
  id: string;
  title: string;
  category: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  status: string;
  versionLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  documents: number;
  boardMeetings: number;
  financialRecords: number;
  complianceItems: number;
  tasks: number;
  products: number;
  contacts: number;
  auditLogs: number;
}

export interface AuditLogRecord {
  id: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  module: string;
  action: string;
  description: string;
  severity: string;
  createdAt: string;
}

export interface SearchResult {
  module: string;
  id: string;
  title: string;
  status: string;
}
