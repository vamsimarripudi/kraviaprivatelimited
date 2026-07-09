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
