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
