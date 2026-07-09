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
