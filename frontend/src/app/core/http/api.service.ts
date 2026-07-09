import { HttpClient, HttpEvent, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlatformApiRecord, PlatformBackupRecord, PlatformEnvironmentRecord, PlatformJobRecord, PlatformOverview, PlatformReleaseRecord, PlatformServiceRecord } from '../models/api.models';
import { AccessReviewRecord, ApprovalDecisionPayload, ApprovalRecord, ApprovalRequestPayload, DataClassification, DataPrivacyRecord, DataPrivacyRequest, EvidencePackRecord, EvidencePackRequestPayload, EvidenceTimelineItem, GovernanceDashboard, RiskCategory, RiskLevel, RiskRecord, RiskRequestPayload, RiskStatus } from '../models/api.models';
import { BankAccountRecord, BankAccountRequest, BankTransactionRecord, BankTransactionRequest, BudgetRecord, BudgetRequest, BudgetStatus, FinanceAccountRecord, FinanceAccountRequest, FinanceAccountType, FinanceErpReport, FinanceErpSummary, FinanceRecordStatus, FinanceReportType, FinancialApprovalRecord, FinancialApprovalRequest, FinancialApprovalStatus, GstFilingStatus, GstRecordErp, GstRecordRequest, InvoiceRecord, InvoiceRequest, InvoiceStatus, JournalApprovalStatus, JournalEntryRecord, JournalEntryRequest, PayableRecord, PayableRequest, PaymentStatus, ReceivableRecord, ReceivableRequest, ReceivableStatus, ReconciliationStatus } from '../models/api.models';
import { ProcurementApprovalPayload, ProcurementApprovalRecord, ProcurementReport, ProcurementReportType, ProcurementStatus, ProcurementSubscriptionPayload, ProcurementSubscriptionRecord, ProcurementSummary, ProcurementVendorRecord, ProcurementVendorRequest, PurchaseOrderPayload, PurchaseOrderRecord, PurchaseRequestPayload, PurchaseRequestRecord, VendorBillPayload, VendorBillRecord, VendorCategory, VendorDocumentPayload, VendorDocumentRecord } from '../models/api.models';
import { AiQueryRecord, AiQueryRequest, AnnouncementRecord, AnnouncementRequest, AuditLogRecord, BoardMeetingRecord, BoardMeetingRequest, CompanyProfile, CompanyTask, CompanyTaskRequest, ContactCategory, ContactRecord, ContactRequest, ContactStatus, ComplianceCategory, ComplianceItem, ComplianceItemRequest, CompliancePriority, ComplianceStatus, DocumentCategory, DocumentMetadataRequest, DocumentRecord, DocumentStatus, EcosystemProductRecord, EcosystemProductRequest, EcosystemProductStatus, EcosystemSummary, ExecutiveDashboard, FinancialRecord, FinancialRecordRequest, MeetingActionItemRecord, MeetingActionItemRequest, MeetingStatus, MeetingType, NotificationRecord, LeadPriority, LeadStage, ProductRecord, ProductRequest, ProductStatus, ReportFilters, ReportResponse, ReportType, SalesCustomerRecord, SalesCustomerRequest, SalesLeadRecord, SalesLeadRequest, SearchResponse, TaskCategory, TaskPriority, TaskStatus, TaskStatusRequest } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  executiveDashboard(): Observable<ExecutiveDashboard> { return this.http.get<ExecutiveDashboard>('/api/platform/dashboard'); }

  getCompanyProfile(): Observable<CompanyProfile> { return this.http.get<CompanyProfile>('/api/company-profile'); }
  saveCompanyProfile(payload: CompanyProfile): Observable<CompanyProfile> { return this.http.put<CompanyProfile>('/api/company-profile', payload); }
  auditLogs(): Observable<AuditLogRecord[]> { return this.http.get<AuditLogRecord[]>('/api/audit-logs'); }

  documents(filters: { query?: string; category?: DocumentCategory | ''; status?: DocumentStatus | '' }): Observable<DocumentRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<DocumentRecord[]>('/api/documents', { params });
  }

  document(id: string): Observable<DocumentRecord> { return this.http.get<DocumentRecord>(`/api/documents/${id}`); }

  uploadDocument(payload: FormData): Observable<HttpEvent<DocumentRecord>> {
    const request = new HttpRequest<FormData>('POST', '/api/documents/upload', payload, { reportProgress: true });
    return this.http.request<DocumentRecord>(request);
  }

  updateDocument(id: string, payload: DocumentMetadataRequest): Observable<DocumentRecord> {
    return this.http.put<DocumentRecord>(`/api/documents/${id}`, payload);
  }

  archiveDocument(id: string): Observable<void> { return this.http.delete<void>(`/api/documents/${id}`); }

  downloadDocument(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`/api/documents/${id}/download`, { observe: 'response', responseType: 'blob' });
  }

  boardMeetings(filters: { query?: string; meetingType?: MeetingType | ''; status?: MeetingStatus | '' }): Observable<BoardMeetingRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.meetingType) params = params.set('meetingType', filters.meetingType);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<BoardMeetingRecord[]>('/api/board-meetings', { params });
  }

  boardMeeting(id: string): Observable<BoardMeetingRecord> { return this.http.get<BoardMeetingRecord>(`/api/board-meetings/${id}`); }

  createBoardMeeting(payload: BoardMeetingRequest): Observable<BoardMeetingRecord> {
    return this.http.post<BoardMeetingRecord>('/api/board-meetings', payload);
  }

  updateBoardMeeting(id: string, payload: BoardMeetingRequest): Observable<BoardMeetingRecord> {
    return this.http.put<BoardMeetingRecord>(`/api/board-meetings/${id}`, payload);
  }

  archiveBoardMeeting(id: string): Observable<void> { return this.http.delete<void>(`/api/board-meetings/${id}`); }

  addMeetingActionItem(meetingId: string, payload: MeetingActionItemRequest): Observable<MeetingActionItemRecord> {
    return this.http.post<MeetingActionItemRecord>(`/api/board-meetings/${meetingId}/action-items`, payload);
  }

  updateMeetingActionItem(meetingId: string, actionItemId: string, payload: MeetingActionItemRequest): Observable<MeetingActionItemRecord> {
    return this.http.put<MeetingActionItemRecord>(`/api/board-meetings/${meetingId}/action-items/${actionItemId}`, payload);
  }

  financialRecords(filters: { query?: string; reportingYear?: string; reportingMonth?: string }): Observable<FinancialRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.reportingYear) params = params.set('reportingYear', filters.reportingYear);
    if (filters.reportingMonth) params = params.set('reportingMonth', filters.reportingMonth);
    return this.http.get<FinancialRecord[]>('/api/financial-records', { params });
  }

  financialRecord(id: string): Observable<FinancialRecord> { return this.http.get<FinancialRecord>(`/api/financial-records/${id}`); }

  createFinancialRecord(payload: FinancialRecordRequest): Observable<FinancialRecord> {
    return this.http.post<FinancialRecord>('/api/financial-records', payload);
  }

  updateFinancialRecord(id: string, payload: FinancialRecordRequest): Observable<FinancialRecord> {
    return this.http.put<FinancialRecord>(`/api/financial-records/${id}`, payload);
  }

  archiveFinancialRecord(id: string): Observable<void> { return this.http.delete<void>(`/api/financial-records/${id}`); }

  complianceItems(filters: { query?: string; category?: ComplianceCategory | ''; status?: ComplianceStatus | ''; priority?: CompliancePriority | '' }): Observable<ComplianceItem[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    return this.http.get<ComplianceItem[]>('/api/compliance-items', { params });
  }

  complianceItem(id: string): Observable<ComplianceItem> { return this.http.get<ComplianceItem>(`/api/compliance-items/${id}`); }

  createComplianceItem(payload: ComplianceItemRequest): Observable<ComplianceItem> {
    return this.http.post<ComplianceItem>('/api/compliance-items', payload);
  }

  updateComplianceItem(id: string, payload: ComplianceItemRequest): Observable<ComplianceItem> {
    return this.http.put<ComplianceItem>(`/api/compliance-items/${id}`, payload);
  }

  archiveComplianceItem(id: string): Observable<void> { return this.http.delete<void>(`/api/compliance-items/${id}`); }
  tasks(filters: { query?: string; category?: TaskCategory | ''; assignee?: string; status?: TaskStatus | ''; priority?: TaskPriority | '' }): Observable<CompanyTask[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.assignee?.trim()) params = params.set('assignee', filters.assignee.trim());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    return this.http.get<CompanyTask[]>('/api/tasks', { params });
  }

  task(id: string): Observable<CompanyTask> { return this.http.get<CompanyTask>(`/api/tasks/${id}`); }

  createTask(payload: CompanyTaskRequest): Observable<CompanyTask> {
    return this.http.post<CompanyTask>('/api/tasks', payload);
  }

  updateTask(id: string, payload: CompanyTaskRequest): Observable<CompanyTask> {
    return this.http.put<CompanyTask>(`/api/tasks/${id}`, payload);
  }

  updateTaskStatus(id: string, payload: TaskStatusRequest): Observable<CompanyTask> {
    return this.http.patch<CompanyTask>(`/api/tasks/${id}/status`, payload);
  }

  completeTask(id: string): Observable<CompanyTask> {
    return this.http.patch<CompanyTask>(`/api/tasks/${id}/complete`, {});
  }

  archiveTask(id: string): Observable<void> { return this.http.delete<void>(`/api/tasks/${id}`); }
  products(filters: { query?: string; status?: ProductStatus | ''; developmentStage?: string }): Observable<ProductRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.developmentStage?.trim()) params = params.set('developmentStage', filters.developmentStage.trim());
    return this.http.get<ProductRecord[]>('/api/products', { params });
  }

  product(id: string): Observable<ProductRecord> { return this.http.get<ProductRecord>(`/api/products/${id}`); }

  createProduct(payload: ProductRequest): Observable<ProductRecord> {
    return this.http.post<ProductRecord>('/api/products', payload);
  }

  updateProduct(id: string, payload: ProductRequest): Observable<ProductRecord> {
    return this.http.put<ProductRecord>(`/api/products/${id}`, payload);
  }

  archiveProduct(id: string): Observable<void> { return this.http.delete<void>(`/api/products/${id}`); }


  salesLeads(filters: { query?: string; stage?: LeadStage | ''; priority?: LeadPriority | '' }): Observable<SalesLeadRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.stage) params = params.set('stage', filters.stage);
    if (filters.priority) params = params.set('priority', filters.priority);
    return this.http.get<SalesLeadRecord[]>('/api/sales/leads', { params });
  }

  salesLead(id: string): Observable<SalesLeadRecord> { return this.http.get<SalesLeadRecord>(`/api/sales/leads/${id}`); }
  createSalesLead(payload: SalesLeadRequest): Observable<SalesLeadRecord> { return this.http.post<SalesLeadRecord>('/api/sales/leads', payload); }
  updateSalesLead(id: string, payload: SalesLeadRequest): Observable<SalesLeadRecord> { return this.http.put<SalesLeadRecord>(`/api/sales/leads/${id}`, payload); }
  archiveSalesLead(id: string): Observable<void> { return this.http.delete<void>(`/api/sales/leads/${id}`); }

  salesCustomers(filters: { query?: string; product?: string; subscriptionStatus?: string }): Observable<SalesCustomerRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.product?.trim()) params = params.set('product', filters.product.trim());
    if (filters.subscriptionStatus?.trim()) params = params.set('subscriptionStatus', filters.subscriptionStatus.trim());
    return this.http.get<SalesCustomerRecord[]>('/api/sales/customers', { params });
  }

  salesCustomer(id: string): Observable<SalesCustomerRecord> { return this.http.get<SalesCustomerRecord>(`/api/sales/customers/${id}`); }
  createSalesCustomer(payload: SalesCustomerRequest): Observable<SalesCustomerRecord> { return this.http.post<SalesCustomerRecord>('/api/sales/customers', payload); }
  updateSalesCustomer(id: string, payload: SalesCustomerRequest): Observable<SalesCustomerRecord> { return this.http.put<SalesCustomerRecord>(`/api/sales/customers/${id}`, payload); }
  archiveSalesCustomer(id: string): Observable<void> { return this.http.delete<void>(`/api/sales/customers/${id}`); }

  ecosystemSummary(): Observable<EcosystemSummary> { return this.http.get<EcosystemSummary>('/api/ecosystem/summary'); }

  ecosystemProducts(filters: { query?: string; status?: EcosystemProductStatus | ''; owner?: string }): Observable<EcosystemProductRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.owner?.trim()) params = params.set('owner', filters.owner.trim());
    return this.http.get<EcosystemProductRecord[]>('/api/ecosystem/products', { params });
  }

  ecosystemProduct(id: string): Observable<EcosystemProductRecord> { return this.http.get<EcosystemProductRecord>(`/api/ecosystem/products/${id}`); }

  createEcosystemProduct(payload: EcosystemProductRequest): Observable<EcosystemProductRecord> {
    return this.http.post<EcosystemProductRecord>('/api/ecosystem/products', payload);
  }

  updateEcosystemProduct(id: string, payload: EcosystemProductRequest): Observable<EcosystemProductRecord> {
    return this.http.put<EcosystemProductRecord>(`/api/ecosystem/products/${id}`, payload);
  }

  archiveEcosystemProduct(id: string): Observable<void> { return this.http.delete<void>(`/api/ecosystem/products/${id}`); }
  contacts(filters: { query?: string; category?: ContactCategory | ''; status?: ContactStatus | '' }): Observable<ContactRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<ContactRecord[]>('/api/contacts', { params });
  }

  contact(id: string): Observable<ContactRecord> { return this.http.get<ContactRecord>(`/api/contacts/${id}`); }

  createContact(payload: ContactRequest): Observable<ContactRecord> {
    return this.http.post<ContactRecord>('/api/contacts', payload);
  }

  updateContact(id: string, payload: ContactRequest): Observable<ContactRecord> {
    return this.http.put<ContactRecord>(`/api/contacts/${id}`, payload);
  }

  archiveContact(id: string): Observable<void> { return this.http.delete<void>(`/api/contacts/${id}`); }
  announcements(): Observable<AnnouncementRecord[]> { return this.http.get<AnnouncementRecord[]>('/api/announcements'); }
  announcement(id: string): Observable<AnnouncementRecord> { return this.http.get<AnnouncementRecord>(`/api/announcements/${id}`); }
  createAnnouncement(payload: AnnouncementRequest): Observable<AnnouncementRecord> { return this.http.post<AnnouncementRecord>('/api/announcements', payload); }
  updateAnnouncement(id: string, payload: AnnouncementRequest): Observable<AnnouncementRecord> { return this.http.put<AnnouncementRecord>(`/api/announcements/${id}`, payload); }
  pinAnnouncement(id: string): Observable<AnnouncementRecord> { return this.http.patch<AnnouncementRecord>(`/api/announcements/${id}/pin`, {}); }
  archiveAnnouncement(id: string): Observable<void> { return this.http.delete<void>(`/api/announcements/${id}`); }

  notifications(): Observable<NotificationRecord[]> { return this.http.get<NotificationRecord[]>('/api/notifications'); }
  markNotificationRead(id: string): Observable<NotificationRecord> { return this.http.patch<NotificationRecord>(`/api/notifications/${id}/read`, {}); }
  markAllNotificationsRead(): Observable<void> { return this.http.patch<void>('/api/notifications/read-all', {}); }
  archiveNotification(id: string): Observable<void> { return this.http.delete<void>(`/api/notifications/${id}`); }

  aiQuery(payload: AiQueryRequest): Observable<AiQueryRecord> { return this.http.post<AiQueryRecord>('/api/ai/query', payload); }
  aiHistory(): Observable<AiQueryRecord[]> { return this.http.get<AiQueryRecord[]>('/api/ai/history'); }
  aiHistoryItem(id: string): Observable<AiQueryRecord> { return this.http.get<AiQueryRecord>(`/api/ai/history/${id}`); }
  archiveAiHistory(id: string): Observable<void> { return this.http.delete<void>(`/api/ai/history/${id}`); }
  report(type: ReportType, filters: ReportFilters): Observable<ReportResponse> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.module?.trim()) params = params.set('module', filters.module.trim());
    return this.http.get<ReportResponse>(`/api/reports/${type}`, { params });
  }

  globalSearch(query: string): Observable<SearchResponse> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<SearchResponse>('/api/search', { params });
  }

  governanceDashboard(): Observable<GovernanceDashboard> { return this.http.get<GovernanceDashboard>('/api/governance/dashboard'); }
  accessReview(): Observable<AccessReviewRecord[]> { return this.http.get<AccessReviewRecord[]>('/api/governance/access-review'); }

  privacyRecords(filters: { moduleName?: string; classification?: DataClassification | '' }): Observable<DataPrivacyRecord[]> {
    let params = new HttpParams();
    if (filters.moduleName?.trim()) params = params.set('moduleName', filters.moduleName.trim());
    if (filters.classification) params = params.set('classification', filters.classification);
    return this.http.get<DataPrivacyRecord[]>('/api/privacy/records', { params });
  }
  createPrivacyRecord(payload: DataPrivacyRequest): Observable<DataPrivacyRecord> { return this.http.post<DataPrivacyRecord>('/api/privacy/records', payload); }
  requestPrivacyExport(id: string): Observable<DataPrivacyRecord> { return this.http.patch<DataPrivacyRecord>(`/api/privacy/records/${id}/export-request`, {}); }
  requestPrivacyDeletion(id: string): Observable<DataPrivacyRecord> { return this.http.patch<DataPrivacyRecord>(`/api/privacy/records/${id}/deletion-request`, {}); }

  approvals(filters: { query?: string; status?: string; linkedModule?: string }): Observable<ApprovalRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('q', filters.query.trim());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.linkedModule?.trim()) params = params.set('linkedModule', filters.linkedModule.trim());
    return this.http.get<ApprovalRecord[]>('/api/approvals', { params });
  }
  createApproval(payload: ApprovalRequestPayload): Observable<ApprovalRecord> { return this.http.post<ApprovalRecord>('/api/approvals', payload); }
  decideApproval(id: string, payload: ApprovalDecisionPayload): Observable<ApprovalRecord> { return this.http.patch<ApprovalRecord>(`/api/approvals/${id}/decision`, payload); }

  risks(filters: { query?: string; category?: RiskCategory | ''; severity?: RiskLevel | ''; status?: RiskStatus | '' }): Observable<RiskRecord[]> {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('q', filters.query.trim());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.severity) params = params.set('severity', filters.severity);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<RiskRecord[]>('/api/risks', { params });
  }
  createRisk(payload: RiskRequestPayload): Observable<RiskRecord> { return this.http.post<RiskRecord>('/api/risks', payload); }

  evidencePacks(): Observable<EvidencePackRecord[]> { return this.http.get<EvidencePackRecord[]>('/api/evidence/packs'); }
  generateEvidencePack(payload: EvidencePackRequestPayload): Observable<EvidencePackRecord> { return this.http.post<EvidencePackRecord>('/api/evidence/packs/generate', payload); }
  evidenceTimeline(): Observable<EvidenceTimelineItem[]> { return this.http.get<EvidenceTimelineItem[]>('/api/evidence/timeline'); }
  financeErpSummary(): Observable<FinanceErpSummary> { return this.http.get<FinanceErpSummary>('/api/finance-erp/dashboard'); }
  financeAccounts(filters: { query?: string; type?: FinanceAccountType | ''; status?: FinanceRecordStatus | '' }): Observable<FinanceAccountRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.type) params = params.set('type', filters.type); if (filters.status) params = params.set('status', filters.status); return this.http.get<FinanceAccountRecord[]>('/api/finance-erp/accounts', { params }); }
  createFinanceAccount(payload: FinanceAccountRequest): Observable<FinanceAccountRecord> { return this.http.post<FinanceAccountRecord>('/api/finance-erp/accounts', payload); }
  updateFinanceAccount(id: string, payload: FinanceAccountRequest): Observable<FinanceAccountRecord> { return this.http.put<FinanceAccountRecord>(`/api/finance-erp/accounts/${id}`, payload); }
  archiveFinanceAccount(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/accounts/${id}`); }
  journalEntries(filters: { query?: string; status?: JournalApprovalStatus | '' }): Observable<JournalEntryRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<JournalEntryRecord[]>('/api/finance-erp/journal-entries', { params }); }
  createJournalEntry(payload: JournalEntryRequest): Observable<JournalEntryRecord> { return this.http.post<JournalEntryRecord>('/api/finance-erp/journal-entries', payload); }
  updateJournalEntry(id: string, payload: JournalEntryRequest): Observable<JournalEntryRecord> { return this.http.put<JournalEntryRecord>(`/api/finance-erp/journal-entries/${id}`, payload); }
  archiveJournalEntry(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/journal-entries/${id}`); }
  financeBankAccounts(filters: { query?: string }): Observable<BankAccountRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); return this.http.get<BankAccountRecord[]>('/api/finance-erp/bank-accounts', { params }); }
  createFinanceBankAccount(payload: BankAccountRequest): Observable<BankAccountRecord> { return this.http.post<BankAccountRecord>('/api/finance-erp/bank-accounts', payload); }
  updateFinanceBankAccount(id: string, payload: BankAccountRequest): Observable<BankAccountRecord> { return this.http.put<BankAccountRecord>(`/api/finance-erp/bank-accounts/${id}`, payload); }
  archiveFinanceBankAccount(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/bank-accounts/${id}`); }
  bankTransactions(filters: { query?: string; status?: ReconciliationStatus | '' }): Observable<BankTransactionRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<BankTransactionRecord[]>('/api/finance-erp/bank-transactions', { params }); }
  createBankTransaction(payload: BankTransactionRequest): Observable<BankTransactionRecord> { return this.http.post<BankTransactionRecord>('/api/finance-erp/bank-transactions', payload); }
  updateBankTransaction(id: string, payload: BankTransactionRequest): Observable<BankTransactionRecord> { return this.http.put<BankTransactionRecord>(`/api/finance-erp/bank-transactions/${id}`, payload); }
  archiveBankTransaction(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/bank-transactions/${id}`); }
  invoices(filters: { query?: string; status?: InvoiceStatus | '' }): Observable<InvoiceRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<InvoiceRecord[]>('/api/finance-erp/invoices', { params }); }
  createInvoice(payload: InvoiceRequest): Observable<InvoiceRecord> { return this.http.post<InvoiceRecord>('/api/finance-erp/invoices', payload); }
  updateInvoice(id: string, payload: InvoiceRequest): Observable<InvoiceRecord> { return this.http.put<InvoiceRecord>(`/api/finance-erp/invoices/${id}`, payload); }
  archiveInvoice(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/invoices/${id}`); }
  receivables(filters: { query?: string; status?: ReceivableStatus | '' }): Observable<ReceivableRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<ReceivableRecord[]>('/api/finance-erp/receivables', { params }); }
  createReceivable(payload: ReceivableRequest): Observable<ReceivableRecord> { return this.http.post<ReceivableRecord>('/api/finance-erp/receivables', payload); }
  updateReceivable(id: string, payload: ReceivableRequest): Observable<ReceivableRecord> { return this.http.put<ReceivableRecord>(`/api/finance-erp/receivables/${id}`, payload); }
  archiveReceivable(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/receivables/${id}`); }
  payables(filters: { query?: string; status?: PaymentStatus | '' }): Observable<PayableRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<PayableRecord[]>('/api/finance-erp/payables', { params }); }
  createPayable(payload: PayableRequest): Observable<PayableRecord> { return this.http.post<PayableRecord>('/api/finance-erp/payables', payload); }
  updatePayable(id: string, payload: PayableRequest): Observable<PayableRecord> { return this.http.put<PayableRecord>(`/api/finance-erp/payables/${id}`, payload); }
  archivePayable(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/payables/${id}`); }
  gstRecords(filters: { query?: string; status?: GstFilingStatus | '' }): Observable<GstRecordErp[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<GstRecordErp[]>('/api/finance-erp/gst-records', { params }); }
  createGstRecord(payload: GstRecordRequest): Observable<GstRecordErp> { return this.http.post<GstRecordErp>('/api/finance-erp/gst-records', payload); }
  updateGstRecord(id: string, payload: GstRecordRequest): Observable<GstRecordErp> { return this.http.put<GstRecordErp>(`/api/finance-erp/gst-records/${id}`, payload); }
  archiveGstRecord(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/gst-records/${id}`); }
  budgets(filters: { query?: string; status?: BudgetStatus | '' }): Observable<BudgetRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<BudgetRecord[]>('/api/finance-erp/budgets', { params }); }
  createBudget(payload: BudgetRequest): Observable<BudgetRecord> { return this.http.post<BudgetRecord>('/api/finance-erp/budgets', payload); }
  updateBudget(id: string, payload: BudgetRequest): Observable<BudgetRecord> { return this.http.put<BudgetRecord>(`/api/finance-erp/budgets/${id}`, payload); }
  archiveBudget(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/budgets/${id}`); }
  financialApprovals(filters: { query?: string; status?: FinancialApprovalStatus | '' }): Observable<FinancialApprovalRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<FinancialApprovalRecord[]>('/api/finance-erp/approvals', { params }); }
  createFinancialApproval(payload: FinancialApprovalRequest): Observable<FinancialApprovalRecord> { return this.http.post<FinancialApprovalRecord>('/api/finance-erp/approvals', payload); }
  updateFinancialApproval(id: string, payload: FinancialApprovalRequest): Observable<FinancialApprovalRecord> { return this.http.put<FinancialApprovalRecord>(`/api/finance-erp/approvals/${id}`, payload); }
  archiveFinancialApproval(id: string): Observable<void> { return this.http.delete<void>(`/api/finance-erp/approvals/${id}`); }
  financeErpReport(type: FinanceReportType): Observable<FinanceErpReport> { return this.http.get<FinanceErpReport>(`/api/finance-erp/reports/${type}`); }

  procurementSummary(): Observable<ProcurementSummary> { return this.http.get<ProcurementSummary>('/api/procurement/summary'); }
  procurementVendors(filters: { query?: string; category?: VendorCategory | ''; status?: ProcurementStatus | '' }): Observable<ProcurementVendorRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.category) params = params.set('category', filters.category); if (filters.status) params = params.set('status', filters.status); return this.http.get<ProcurementVendorRecord[]>('/api/procurement/vendors', { params }); }
  createProcurementVendor(payload: ProcurementVendorRequest): Observable<ProcurementVendorRecord> { return this.http.post<ProcurementVendorRecord>('/api/procurement/vendors', payload); }
  updateProcurementVendor(id: string, payload: ProcurementVendorRequest): Observable<ProcurementVendorRecord> { return this.http.put<ProcurementVendorRecord>(`/api/procurement/vendors/${id}`, payload); }
  archiveProcurementVendor(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/vendors/${id}`); }
  purchaseRequests(filters: { query?: string; status?: ProcurementStatus | ''; approvalStatus?: ProcurementStatus | '' }): Observable<PurchaseRequestRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); if (filters.approvalStatus) params = params.set('approvalStatus', filters.approvalStatus); return this.http.get<PurchaseRequestRecord[]>('/api/procurement/purchase-requests', { params }); }
  createPurchaseRequest(payload: PurchaseRequestPayload): Observable<PurchaseRequestRecord> { return this.http.post<PurchaseRequestRecord>('/api/procurement/purchase-requests', payload); }
  updatePurchaseRequest(id: string, payload: PurchaseRequestPayload): Observable<PurchaseRequestRecord> { return this.http.put<PurchaseRequestRecord>(`/api/procurement/purchase-requests/${id}`, payload); }
  archivePurchaseRequest(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/purchase-requests/${id}`); }
  purchaseOrders(filters: { query?: string; status?: ProcurementStatus | '' }): Observable<PurchaseOrderRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<PurchaseOrderRecord[]>('/api/procurement/purchase-orders', { params }); }
  createPurchaseOrder(payload: PurchaseOrderPayload): Observable<PurchaseOrderRecord> { return this.http.post<PurchaseOrderRecord>('/api/procurement/purchase-orders', payload); }
  updatePurchaseOrder(id: string, payload: PurchaseOrderPayload): Observable<PurchaseOrderRecord> { return this.http.put<PurchaseOrderRecord>(`/api/procurement/purchase-orders/${id}`, payload); }
  archivePurchaseOrder(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/purchase-orders/${id}`); }
  vendorBills(filters: { query?: string; paymentStatus?: ProcurementStatus | '' }): Observable<VendorBillRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.paymentStatus) params = params.set('paymentStatus', filters.paymentStatus); return this.http.get<VendorBillRecord[]>('/api/procurement/vendor-bills', { params }); }
  createVendorBill(payload: VendorBillPayload): Observable<VendorBillRecord> { return this.http.post<VendorBillRecord>('/api/procurement/vendor-bills', payload); }
  updateVendorBill(id: string, payload: VendorBillPayload): Observable<VendorBillRecord> { return this.http.put<VendorBillRecord>(`/api/procurement/vendor-bills/${id}`, payload); }
  archiveVendorBill(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/vendor-bills/${id}`); }
  procurementSubscriptions(filters: { query?: string; status?: ProcurementStatus | '' }): Observable<ProcurementSubscriptionRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<ProcurementSubscriptionRecord[]>('/api/procurement/subscriptions', { params }); }
  createProcurementSubscription(payload: ProcurementSubscriptionPayload): Observable<ProcurementSubscriptionRecord> { return this.http.post<ProcurementSubscriptionRecord>('/api/procurement/subscriptions', payload); }
  updateProcurementSubscription(id: string, payload: ProcurementSubscriptionPayload): Observable<ProcurementSubscriptionRecord> { return this.http.put<ProcurementSubscriptionRecord>(`/api/procurement/subscriptions/${id}`, payload); }
  archiveProcurementSubscription(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/subscriptions/${id}`); }
  procurementApprovals(filters: { query?: string; status?: ProcurementStatus | '' }): Observable<ProcurementApprovalRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<ProcurementApprovalRecord[]>('/api/procurement/approvals', { params }); }
  createProcurementApproval(payload: ProcurementApprovalPayload): Observable<ProcurementApprovalRecord> { return this.http.post<ProcurementApprovalRecord>('/api/procurement/approvals', payload); }
  updateProcurementApproval(id: string, payload: ProcurementApprovalPayload): Observable<ProcurementApprovalRecord> { return this.http.put<ProcurementApprovalRecord>(`/api/procurement/approvals/${id}`, payload); }
  archiveProcurementApproval(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/approvals/${id}`); }
  vendorDocuments(filters: { query?: string; status?: ProcurementStatus | '' }): Observable<VendorDocumentRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<VendorDocumentRecord[]>('/api/procurement/vendor-documents', { params }); }
  createVendorDocument(payload: VendorDocumentPayload): Observable<VendorDocumentRecord> { return this.http.post<VendorDocumentRecord>('/api/procurement/vendor-documents', payload); }
  updateVendorDocument(id: string, payload: VendorDocumentPayload): Observable<VendorDocumentRecord> { return this.http.put<VendorDocumentRecord>(`/api/procurement/vendor-documents/${id}`, payload); }
  archiveVendorDocument(id: string): Observable<void> { return this.http.delete<void>(`/api/procurement/vendor-documents/${id}`); }
  procurementReport(type: ProcurementReportType): Observable<ProcurementReport> { return this.http.get<ProcurementReport>('/api/procurement/reports', { params: new HttpParams().set('type', type) }); }
  platformOverview(): Observable<PlatformOverview> { return this.http.get<PlatformOverview>('/api/platform-admin/overview'); }
  createPlatformEnvironment(payload: Partial<PlatformEnvironmentRecord>): Observable<PlatformEnvironmentRecord> { return this.http.post<PlatformEnvironmentRecord>('/api/platform-admin/environments', payload); }
  createPlatformService(payload: Partial<PlatformServiceRecord>): Observable<PlatformServiceRecord> { return this.http.post<PlatformServiceRecord>('/api/platform-admin/services', payload); }
  createPlatformRelease(payload: Partial<PlatformReleaseRecord>): Observable<PlatformReleaseRecord> { return this.http.post<PlatformReleaseRecord>('/api/platform-admin/releases', payload); }
  createPlatformBackup(payload: Partial<PlatformBackupRecord>): Observable<PlatformBackupRecord> { return this.http.post<PlatformBackupRecord>('/api/platform-admin/backups', payload); }
  createPlatformJob(payload: Partial<PlatformJobRecord>): Observable<PlatformJobRecord> { return this.http.post<PlatformJobRecord>('/api/platform-admin/jobs', payload); }
  createPlatformApi(payload: Partial<PlatformApiRecord>): Observable<PlatformApiRecord> { return this.http.post<PlatformApiRecord>('/api/platform-admin/apis', payload); }}
