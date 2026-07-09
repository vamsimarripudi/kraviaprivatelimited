import { HttpClient, HttpEvent, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ContractType, LegalApprovalRecord, LegalApprovalRequest, LegalContractRecord, LegalContractRequest, LegalNoticeRecord, LegalNoticeRequest, LegalObligationRecord, LegalObligationRequest, LegalPriority, LegalReport, LegalReportType, LegalRiskRecord, LegalRiskRequest, LegalRiskSeverity, LegalStatus, LegalSummary } from '../models/api.models';
import { AttendanceRecord, AttendanceRequest, AttendanceStatus, CertificationRecord, CertificationRequest, DepartmentRecord, DepartmentRequest, DesignationRecord, DesignationRequest, EmployeeContactRecord, EmployeeContactRequest, EmployeeRecord, EmployeeRequest, EmploymentStatus, ExitRecord, ExitRequestPayload, ExitStatus, HolidayRecord, HolidayRequest, HrReport, HrReportType, HrSummary, LeaveRecord, LeaveRequestPayload, LeaveStatus, PayrollRecord, PayrollRequest, PayrollStatus, PerformanceReviewRecord, PerformanceReviewRequest, TrainingRecord, TrainingRequest, TrainingStatus } from '../models/api.models';
import { PlatformApiRecord, PlatformBackupRecord, PlatformEnvironmentRecord, PlatformJobRecord, PlatformOverview, PlatformReleaseRecord, PlatformServiceRecord } from '../models/api.models';
import { AssetAssignmentPayload, AssetAssignmentRecord, AssetCategory, AssetDocumentPayload, AssetDocumentRecord, AssetMaintenancePayload, AssetMaintenanceRecord, AssetRecord, AssetReport, AssetReportType, AssetRequestPayload, AssetStatus, AssetSummary, CloudResourcePayload, CloudResourceRecord, SoftwareLicensePayload, SoftwareLicenseRecord } from '../models/api.models';
import { AccessReviewRecord, ApprovalDecisionPayload, ApprovalRecord, ApprovalRequestPayload, DataClassification, DataPrivacyRecord, DataPrivacyRequest, EvidencePackRecord, EvidencePackRequestPayload, EvidenceTimelineItem, GovernanceDashboard, RiskCategory, RiskLevel, RiskRecord, RiskRequestPayload, RiskStatus } from '../models/api.models';
import { BankAccountRecord, BankAccountRequest, BankTransactionRecord, BankTransactionRequest, BudgetRecord, BudgetRequest, BudgetStatus, FinanceAccountRecord, FinanceAccountRequest, FinanceAccountType, FinanceErpReport, FinanceErpSummary, FinanceRecordStatus, FinanceReportType, FinancialApprovalRecord, FinancialApprovalRequest, FinancialApprovalStatus, GstFilingStatus, GstRecordErp, GstRecordRequest, InvoiceRecord, InvoiceRequest, InvoiceStatus, JournalApprovalStatus, JournalEntryRecord, JournalEntryRequest, PayableRecord, PayableRequest, PaymentStatus, ReceivableRecord, ReceivableRequest, ReceivableStatus, ReconciliationStatus } from '../models/api.models';
import { ProcurementApprovalPayload, ProcurementApprovalRecord, ProcurementReport, ProcurementReportType, ProcurementStatus, ProcurementSubscriptionPayload, ProcurementSubscriptionRecord, ProcurementSummary, ProcurementVendorRecord, ProcurementVendorRequest, PurchaseOrderPayload, PurchaseOrderRecord, PurchaseRequestPayload, PurchaseRequestRecord, VendorBillPayload, VendorBillRecord, VendorCategory, VendorDocumentPayload, VendorDocumentRecord } from '../models/api.models';
import { AiQueryRecord, AiQueryRequest, AnnouncementRecord, AnnouncementRequest, AuditLogRecord, BoardMeetingRecord, BoardMeetingRequest, CompanyProfile, CompanyTask, CompanyTaskRequest, ContactCategory, ContactRecord, ContactRequest, ContactStatus, ComplianceCategory, ComplianceItem, ComplianceItemRequest, CompliancePriority, ComplianceStatus, DocumentCategory, DocumentMetadataRequest, DocumentRecord, DocumentStatus, EcosystemProductRecord, EcosystemProductRequest, EcosystemProductStatus, EcosystemSummary, ExecutiveDashboard, FinancialRecord, FinancialRecordRequest, MeetingActionItemRecord, MeetingActionItemRequest, MeetingStatus, MeetingType, NotificationRecord, LeadPriority, LeadStage, ProductRecord, ProductRequest, ProductStatus, ReportFilters, ReportResponse, ReportType, SalesCustomerRecord, SalesCustomerRequest, SalesLeadRecord, SalesLeadRequest, SearchResponse, TaskCategory, TaskPriority, TaskStatus, TaskStatusRequest } from '../models/api.models';
import { AnalyticsDashboard, AnalyticsExportRequest, AnalyticsExportResponse, AnalyticsModule } from '../models/api.models';
import { ScheduledJobPayload, ScheduledJobRecord, ScheduledJobStatus, WorkflowActionPayload, WorkflowActionRecord, WorkflowActionStatus, WorkflowActionType, WorkflowCommandPayload, WorkflowEngineState, WorkflowEngineSummary, WorkflowEngineType, WorkflowInstanceRecord, WorkflowInstanceStepPayload, WorkflowReportRecord, WorkflowReportType, WorkflowRulePayload, WorkflowRuleRecord, WorkflowRuleStatus, WorkflowStartPayload, WorkflowTemplatePayload, WorkflowTemplateRecord, WorkflowTemplateStatus, WorkflowTemplateStepRecord, WorkflowStepPayload } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  executiveDashboard(): Observable<ExecutiveDashboard> { return this.http.get<ExecutiveDashboard>('/api/platform/dashboard'); }
  analyticsDashboard(module: AnalyticsModule, filters: { from?: string | null; to?: string | null }): Observable<AnalyticsDashboard> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return this.http.get<AnalyticsDashboard>(`/api/analytics/${module.toLowerCase()}`, { params });
  }
  requestAnalyticsExport(payload: AnalyticsExportRequest): Observable<AnalyticsExportResponse> { return this.http.post<AnalyticsExportResponse>('/api/analytics/export', payload); }
  workflowSummary(): Observable<WorkflowEngineSummary> { return this.http.get<WorkflowEngineSummary>('/api/workflow-engine/summary'); }
  workflowTemplates(filters: { q?: string; status?: WorkflowTemplateStatus | ''; workflowType?: WorkflowEngineType | '' }): Observable<WorkflowTemplateRecord[]> { let params = new HttpParams(); if (filters.q?.trim()) params = params.set('q', filters.q.trim()); if (filters.status) params = params.set('status', filters.status); if (filters.workflowType) params = params.set('workflowType', filters.workflowType); return this.http.get<WorkflowTemplateRecord[]>('/api/workflow-engine/templates', { params }); }
  createWorkflowTemplate(payload: WorkflowTemplatePayload): Observable<WorkflowTemplateRecord> { return this.http.post<WorkflowTemplateRecord>('/api/workflow-engine/templates', payload); }
  updateWorkflowTemplate(id: string, payload: WorkflowTemplatePayload): Observable<WorkflowTemplateRecord> { return this.http.put<WorkflowTemplateRecord>(`/api/workflow-engine/templates/${id}`, payload); }
  archiveWorkflowTemplate(id: string): Observable<void> { return this.http.delete<void>(`/api/workflow-engine/templates/${id}`); }
  addWorkflowStep(templateId: string, payload: WorkflowStepPayload): Observable<WorkflowTemplateStepRecord> { return this.http.post<WorkflowTemplateStepRecord>(`/api/workflow-engine/templates/${templateId}/steps`, payload); }
  workflowInstances(filters: { q?: string; state?: WorkflowEngineState | ''; workflowType?: WorkflowEngineType | '' }): Observable<WorkflowInstanceRecord[]> { let params = new HttpParams(); if (filters.q?.trim()) params = params.set('q', filters.q.trim()); if (filters.state) params = params.set('state', filters.state); if (filters.workflowType) params = params.set('workflowType', filters.workflowType); return this.http.get<WorkflowInstanceRecord[]>('/api/workflow-engine/instances', { params }); }
  startWorkflow(payload: WorkflowStartPayload): Observable<WorkflowInstanceRecord> { return this.http.post<WorkflowInstanceRecord>('/api/workflow-engine/instances/start', payload); }
  commandWorkflow(id: string, payload: WorkflowCommandPayload): Observable<WorkflowInstanceRecord> { return this.http.patch<WorkflowInstanceRecord>(`/api/workflow-engine/instances/${id}/command`, payload); }
  updateWorkflowInstanceStep(instanceId: string, stepId: string, payload: WorkflowInstanceStepPayload): Observable<WorkflowInstanceRecord> { return this.http.patch<WorkflowInstanceRecord>(`/api/workflow-engine/instances/${instanceId}/steps/${stepId}`, payload); }
  workflowActions(filters: { workflowInstanceId?: string; actionType?: WorkflowActionType | ''; status?: WorkflowActionStatus | '' }): Observable<WorkflowActionRecord[]> { let params = new HttpParams(); if (filters.workflowInstanceId) params = params.set('workflowInstanceId', filters.workflowInstanceId); if (filters.actionType) params = params.set('actionType', filters.actionType); if (filters.status) params = params.set('status', filters.status); return this.http.get<WorkflowActionRecord[]>('/api/workflow-engine/actions', { params }); }
  createWorkflowAction(payload: WorkflowActionPayload): Observable<WorkflowActionRecord> { return this.http.post<WorkflowActionRecord>('/api/workflow-engine/actions', payload); }
  workflowRules(filters: { q?: string; status?: WorkflowRuleStatus | '' }): Observable<WorkflowRuleRecord[]> { let params = new HttpParams(); if (filters.q?.trim()) params = params.set('q', filters.q.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<WorkflowRuleRecord[]>('/api/workflow-engine/rules', { params }); }
  createWorkflowRule(payload: WorkflowRulePayload): Observable<WorkflowRuleRecord> { return this.http.post<WorkflowRuleRecord>('/api/workflow-engine/rules', payload); }
  updateWorkflowRule(id: string, payload: WorkflowRulePayload): Observable<WorkflowRuleRecord> { return this.http.put<WorkflowRuleRecord>(`/api/workflow-engine/rules/${id}`, payload); }
  archiveWorkflowRule(id: string): Observable<void> { return this.http.delete<void>(`/api/workflow-engine/rules/${id}`); }
  scheduledWorkflowJobs(filters: { q?: string; status?: ScheduledJobStatus | '' }): Observable<ScheduledJobRecord[]> { let params = new HttpParams(); if (filters.q?.trim()) params = params.set('q', filters.q.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<ScheduledJobRecord[]>('/api/workflow-engine/scheduled-jobs', { params }); }
  createScheduledWorkflowJob(payload: ScheduledJobPayload): Observable<ScheduledJobRecord> { return this.http.post<ScheduledJobRecord>('/api/workflow-engine/scheduled-jobs', payload); }
  updateScheduledWorkflowJob(id: string, payload: ScheduledJobPayload): Observable<ScheduledJobRecord> { return this.http.put<ScheduledJobRecord>(`/api/workflow-engine/scheduled-jobs/${id}`, payload); }
  archiveScheduledWorkflowJob(id: string): Observable<void> { return this.http.delete<void>(`/api/workflow-engine/scheduled-jobs/${id}`); }
  workflowReport(type: WorkflowReportType): Observable<WorkflowReportRecord> { return this.http.get<WorkflowReportRecord>('/api/workflow-engine/reports', { params: new HttpParams().set('type', type) }); }

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
  assetSummary(): Observable<AssetSummary> { return this.http.get<AssetSummary>('/api/assets/summary'); }
  assets(filters: { query?: string; category?: AssetCategory | ''; status?: AssetStatus | '' }): Observable<AssetRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.category) params = params.set('category', filters.category); if (filters.status) params = params.set('status', filters.status); return this.http.get<AssetRecord[]>('/api/assets', { params }); }
  createAsset(payload: AssetRequestPayload): Observable<AssetRecord> { return this.http.post<AssetRecord>('/api/assets', payload); }
  updateAsset(id: string, payload: AssetRequestPayload): Observable<AssetRecord> { return this.http.put<AssetRecord>(`/api/assets/${id}`, payload); }
  archiveAsset(id: string): Observable<void> { return this.http.delete<void>(`/api/assets/${id}`); }
  assetAssignments(filters: { query?: string; status?: AssetStatus | '' }): Observable<AssetAssignmentRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<AssetAssignmentRecord[]>('/api/assets/assignments', { params }); }
  createAssetAssignment(payload: AssetAssignmentPayload): Observable<AssetAssignmentRecord> { return this.http.post<AssetAssignmentRecord>('/api/assets/assignments', payload); }
  updateAssetAssignment(id: string, payload: AssetAssignmentPayload): Observable<AssetAssignmentRecord> { return this.http.put<AssetAssignmentRecord>(`/api/assets/assignments/${id}`, payload); }
  archiveAssetAssignment(id: string): Observable<void> { return this.http.delete<void>(`/api/assets/assignments/${id}`); }
  assetMaintenance(filters: { query?: string; status?: AssetStatus | '' }): Observable<AssetMaintenanceRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<AssetMaintenanceRecord[]>('/api/assets/maintenance', { params }); }
  createAssetMaintenance(payload: AssetMaintenancePayload): Observable<AssetMaintenanceRecord> { return this.http.post<AssetMaintenanceRecord>('/api/assets/maintenance', payload); }
  updateAssetMaintenance(id: string, payload: AssetMaintenancePayload): Observable<AssetMaintenanceRecord> { return this.http.put<AssetMaintenanceRecord>(`/api/assets/maintenance/${id}`, payload); }
  archiveAssetMaintenance(id: string): Observable<void> { return this.http.delete<void>(`/api/assets/maintenance/${id}`); }
  softwareLicenses(filters: { query?: string; status?: AssetStatus | '' }): Observable<SoftwareLicenseRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<SoftwareLicenseRecord[]>('/api/assets/licenses', { params }); }
  createSoftwareLicense(payload: SoftwareLicensePayload): Observable<SoftwareLicenseRecord> { return this.http.post<SoftwareLicenseRecord>('/api/assets/licenses', payload); }
  updateSoftwareLicense(id: string, payload: SoftwareLicensePayload): Observable<SoftwareLicenseRecord> { return this.http.put<SoftwareLicenseRecord>(`/api/assets/licenses/${id}`, payload); }
  archiveSoftwareLicense(id: string): Observable<void> { return this.http.delete<void>(`/api/assets/licenses/${id}`); }
  cloudResources(filters: { query?: string; status?: AssetStatus | '' }): Observable<CloudResourceRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<CloudResourceRecord[]>('/api/assets/cloud-resources', { params }); }
  createCloudResource(payload: CloudResourcePayload): Observable<CloudResourceRecord> { return this.http.post<CloudResourceRecord>('/api/assets/cloud-resources', payload); }
  updateCloudResource(id: string, payload: CloudResourcePayload): Observable<CloudResourceRecord> { return this.http.put<CloudResourceRecord>(`/api/assets/cloud-resources/${id}`, payload); }
  archiveCloudResource(id: string): Observable<void> { return this.http.delete<void>(`/api/assets/cloud-resources/${id}`); }
  assetDocuments(filters: { query?: string; status?: AssetStatus | '' }): Observable<AssetDocumentRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<AssetDocumentRecord[]>('/api/assets/documents', { params }); }
  createAssetDocument(payload: AssetDocumentPayload): Observable<AssetDocumentRecord> { return this.http.post<AssetDocumentRecord>('/api/assets/documents', payload); }
  updateAssetDocument(id: string, payload: AssetDocumentPayload): Observable<AssetDocumentRecord> { return this.http.put<AssetDocumentRecord>(`/api/assets/documents/${id}`, payload); }
  archiveAssetDocument(id: string): Observable<void> { return this.http.delete<void>(`/api/assets/documents/${id}`); }
  assetReport(type: AssetReportType): Observable<AssetReport> { return this.http.get<AssetReport>('/api/assets/reports', { params: new HttpParams().set('type', type) }); }
  platformOverview(): Observable<PlatformOverview> { return this.http.get<PlatformOverview>('/api/platform-admin/overview'); }
  createPlatformEnvironment(payload: Partial<PlatformEnvironmentRecord>): Observable<PlatformEnvironmentRecord> { return this.http.post<PlatformEnvironmentRecord>('/api/platform-admin/environments', payload); }
  createPlatformService(payload: Partial<PlatformServiceRecord>): Observable<PlatformServiceRecord> { return this.http.post<PlatformServiceRecord>('/api/platform-admin/services', payload); }
  createPlatformRelease(payload: Partial<PlatformReleaseRecord>): Observable<PlatformReleaseRecord> { return this.http.post<PlatformReleaseRecord>('/api/platform-admin/releases', payload); }
  createPlatformBackup(payload: Partial<PlatformBackupRecord>): Observable<PlatformBackupRecord> { return this.http.post<PlatformBackupRecord>('/api/platform-admin/backups', payload); }
  createPlatformJob(payload: Partial<PlatformJobRecord>): Observable<PlatformJobRecord> { return this.http.post<PlatformJobRecord>('/api/platform-admin/jobs', payload); }
  createPlatformApi(payload: Partial<PlatformApiRecord>): Observable<PlatformApiRecord> { return this.http.post<PlatformApiRecord>('/api/platform-admin/apis', payload); }
  hrSummary(): Observable<HrSummary> { return this.http.get<HrSummary>('/api/hr/summary'); }
  hrDepartments(filters: { query?: string }): Observable<DepartmentRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); return this.http.get<DepartmentRecord[]>('/api/hr/departments', { params }); }
  createHrDepartment(payload: DepartmentRequest): Observable<DepartmentRecord> { return this.http.post<DepartmentRecord>('/api/hr/departments', payload); }
  updateHrDepartment(id: string, payload: DepartmentRequest): Observable<DepartmentRecord> { return this.http.put<DepartmentRecord>(`/api/hr/departments/${id}`, payload); }
  archiveHrDepartment(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/departments/${id}`); }
  hrDesignations(filters: { query?: string }): Observable<DesignationRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); return this.http.get<DesignationRecord[]>('/api/hr/designations', { params }); }
  createHrDesignation(payload: DesignationRequest): Observable<DesignationRecord> { return this.http.post<DesignationRecord>('/api/hr/designations', payload); }
  updateHrDesignation(id: string, payload: DesignationRequest): Observable<DesignationRecord> { return this.http.put<DesignationRecord>(`/api/hr/designations/${id}`, payload); }
  archiveHrDesignation(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/designations/${id}`); }
  hrEmployees(filters: { query?: string; status?: EmploymentStatus | '' }): Observable<EmployeeRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<EmployeeRecord[]>('/api/hr/employees', { params }); }
  createHrEmployee(payload: EmployeeRequest): Observable<EmployeeRecord> { return this.http.post<EmployeeRecord>('/api/hr/employees', payload); }
  updateHrEmployee(id: string, payload: EmployeeRequest): Observable<EmployeeRecord> { return this.http.put<EmployeeRecord>(`/api/hr/employees/${id}`, payload); }
  archiveHrEmployee(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/employees/${id}`); }
  hrContacts(filters: { query?: string }): Observable<EmployeeContactRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); return this.http.get<EmployeeContactRecord[]>('/api/hr/contacts', { params }); }
  createHrContact(payload: EmployeeContactRequest): Observable<EmployeeContactRecord> { return this.http.post<EmployeeContactRecord>('/api/hr/contacts', payload); }
  updateHrContact(id: string, payload: EmployeeContactRequest): Observable<EmployeeContactRecord> { return this.http.put<EmployeeContactRecord>(`/api/hr/contacts/${id}`, payload); }
  archiveHrContact(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/contacts/${id}`); }
  hrAttendance(filters: { query?: string; status?: AttendanceStatus | '' }): Observable<AttendanceRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<AttendanceRecord[]>('/api/hr/attendance', { params }); }
  createHrAttendance(payload: AttendanceRequest): Observable<AttendanceRecord> { return this.http.post<AttendanceRecord>('/api/hr/attendance', payload); }
  updateHrAttendance(id: string, payload: AttendanceRequest): Observable<AttendanceRecord> { return this.http.put<AttendanceRecord>(`/api/hr/attendance/${id}`, payload); }
  archiveHrAttendance(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/attendance/${id}`); }
  hrLeaveRequests(filters: { query?: string; status?: LeaveStatus | '' }): Observable<LeaveRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<LeaveRecord[]>('/api/hr/leave-requests', { params }); }
  createHrLeaveRequest(payload: LeaveRequestPayload): Observable<LeaveRecord> { return this.http.post<LeaveRecord>('/api/hr/leave-requests', payload); }
  updateHrLeaveRequest(id: string, payload: LeaveRequestPayload): Observable<LeaveRecord> { return this.http.put<LeaveRecord>(`/api/hr/leave-requests/${id}`, payload); }
  archiveHrLeaveRequest(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/leave-requests/${id}`); }
  hrHolidays(filters: { query?: string }): Observable<HolidayRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); return this.http.get<HolidayRecord[]>('/api/hr/holidays', { params }); }
  createHrHoliday(payload: HolidayRequest): Observable<HolidayRecord> { return this.http.post<HolidayRecord>('/api/hr/holidays', payload); }
  updateHrHoliday(id: string, payload: HolidayRequest): Observable<HolidayRecord> { return this.http.put<HolidayRecord>(`/api/hr/holidays/${id}`, payload); }
  archiveHrHoliday(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/holidays/${id}`); }
  hrPayrollSummaries(filters: { query?: string; status?: PayrollStatus | '' }): Observable<PayrollRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<PayrollRecord[]>('/api/hr/payroll-summaries', { params }); }
  createHrPayrollSummary(payload: PayrollRequest): Observable<PayrollRecord> { return this.http.post<PayrollRecord>('/api/hr/payroll-summaries', payload); }
  updateHrPayrollSummary(id: string, payload: PayrollRequest): Observable<PayrollRecord> { return this.http.put<PayrollRecord>(`/api/hr/payroll-summaries/${id}`, payload); }
  archiveHrPayrollSummary(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/payroll-summaries/${id}`); }
  hrPerformanceReviews(filters: { query?: string }): Observable<PerformanceReviewRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); return this.http.get<PerformanceReviewRecord[]>('/api/hr/performance-reviews', { params }); }
  createHrPerformanceReview(payload: PerformanceReviewRequest): Observable<PerformanceReviewRecord> { return this.http.post<PerformanceReviewRecord>('/api/hr/performance-reviews', payload); }
  updateHrPerformanceReview(id: string, payload: PerformanceReviewRequest): Observable<PerformanceReviewRecord> { return this.http.put<PerformanceReviewRecord>(`/api/hr/performance-reviews/${id}`, payload); }
  archiveHrPerformanceReview(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/performance-reviews/${id}`); }
  hrTrainings(filters: { query?: string; status?: TrainingStatus | '' }): Observable<TrainingRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<TrainingRecord[]>('/api/hr/trainings', { params }); }
  createHrTraining(payload: TrainingRequest): Observable<TrainingRecord> { return this.http.post<TrainingRecord>('/api/hr/trainings', payload); }
  updateHrTraining(id: string, payload: TrainingRequest): Observable<TrainingRecord> { return this.http.put<TrainingRecord>(`/api/hr/trainings/${id}`, payload); }
  archiveHrTraining(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/trainings/${id}`); }
  hrCertifications(filters: { query?: string; status?: TrainingStatus | '' }): Observable<CertificationRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<CertificationRecord[]>('/api/hr/certifications', { params }); }
  createHrCertification(payload: CertificationRequest): Observable<CertificationRecord> { return this.http.post<CertificationRecord>('/api/hr/certifications', payload); }
  updateHrCertification(id: string, payload: CertificationRequest): Observable<CertificationRecord> { return this.http.put<CertificationRecord>(`/api/hr/certifications/${id}`, payload); }
  archiveHrCertification(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/certifications/${id}`); }
  hrExitRecords(filters: { query?: string; status?: ExitStatus | '' }): Observable<ExitRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<ExitRecord[]>('/api/hr/exit-records', { params }); }
  createHrExitRecord(payload: ExitRequestPayload): Observable<ExitRecord> { return this.http.post<ExitRecord>('/api/hr/exit-records', payload); }
  updateHrExitRecord(id: string, payload: ExitRequestPayload): Observable<ExitRecord> { return this.http.put<ExitRecord>(`/api/hr/exit-records/${id}`, payload); }
  archiveHrExitRecord(id: string): Observable<void> { return this.http.delete<void>(`/api/hr/exit-records/${id}`); }
  hrReport(type: HrReportType): Observable<HrReport> { return this.http.get<HrReport>('/api/hr/reports', { params: new HttpParams().set('type', type) }); }

  legalSummary(): Observable<LegalSummary> { return this.http.get<LegalSummary>('/api/legal/summary'); }
  legalContracts(filters: { query?: string; type?: ContractType | ''; status?: LegalStatus | '' }): Observable<LegalContractRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.type) params = params.set('type', filters.type); if (filters.status) params = params.set('status', filters.status); return this.http.get<LegalContractRecord[]>('/api/legal/contracts', { params }); }
  createLegalContract(payload: LegalContractRequest): Observable<LegalContractRecord> { return this.http.post<LegalContractRecord>('/api/legal/contracts', payload); }
  updateLegalContract(id: string, payload: LegalContractRequest): Observable<LegalContractRecord> { return this.http.put<LegalContractRecord>(`/api/legal/contracts/${id}`, payload); }
  archiveLegalContract(id: string): Observable<void> { return this.http.delete<void>(`/api/legal/contracts/${id}`); }
  legalObligations(filters: { query?: string; status?: LegalStatus | ''; priority?: LegalPriority | '' }): Observable<LegalObligationRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); if (filters.priority) params = params.set('priority', filters.priority); return this.http.get<LegalObligationRecord[]>('/api/legal/obligations', { params }); }
  createLegalObligation(payload: LegalObligationRequest): Observable<LegalObligationRecord> { return this.http.post<LegalObligationRecord>('/api/legal/obligations', payload); }
  updateLegalObligation(id: string, payload: LegalObligationRequest): Observable<LegalObligationRecord> { return this.http.put<LegalObligationRecord>(`/api/legal/obligations/${id}`, payload); }
  archiveLegalObligation(id: string): Observable<void> { return this.http.delete<void>(`/api/legal/obligations/${id}`); }
  legalApprovals(filters: { query?: string; status?: LegalStatus | '' }): Observable<LegalApprovalRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<LegalApprovalRecord[]>('/api/legal/approvals', { params }); }
  createLegalApproval(payload: LegalApprovalRequest): Observable<LegalApprovalRecord> { return this.http.post<LegalApprovalRecord>('/api/legal/approvals', payload); }
  updateLegalApproval(id: string, payload: LegalApprovalRequest): Observable<LegalApprovalRecord> { return this.http.put<LegalApprovalRecord>(`/api/legal/approvals/${id}`, payload); }
  archiveLegalApproval(id: string): Observable<void> { return this.http.delete<void>(`/api/legal/approvals/${id}`); }
  legalNotices(filters: { query?: string; status?: LegalStatus | '' }): Observable<LegalNoticeRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.status) params = params.set('status', filters.status); return this.http.get<LegalNoticeRecord[]>('/api/legal/notices', { params }); }
  createLegalNotice(payload: LegalNoticeRequest): Observable<LegalNoticeRecord> { return this.http.post<LegalNoticeRecord>('/api/legal/notices', payload); }
  updateLegalNotice(id: string, payload: LegalNoticeRequest): Observable<LegalNoticeRecord> { return this.http.put<LegalNoticeRecord>(`/api/legal/notices/${id}`, payload); }
  archiveLegalNotice(id: string): Observable<void> { return this.http.delete<void>(`/api/legal/notices/${id}`); }
  legalRisks(filters: { query?: string; severity?: LegalRiskSeverity | ''; status?: LegalStatus | '' }): Observable<LegalRiskRecord[]> { let params = new HttpParams(); if (filters.query?.trim()) params = params.set('query', filters.query.trim()); if (filters.severity) params = params.set('severity', filters.severity); if (filters.status) params = params.set('status', filters.status); return this.http.get<LegalRiskRecord[]>('/api/legal/risks', { params }); }
  createLegalRisk(payload: LegalRiskRequest): Observable<LegalRiskRecord> { return this.http.post<LegalRiskRecord>('/api/legal/risks', payload); }
  updateLegalRisk(id: string, payload: LegalRiskRequest): Observable<LegalRiskRecord> { return this.http.put<LegalRiskRecord>(`/api/legal/risks/${id}`, payload); }
  archiveLegalRisk(id: string): Observable<void> { return this.http.delete<void>(`/api/legal/risks/${id}`); }
  legalReport(type: LegalReportType): Observable<LegalReport> { return this.http.get<LegalReport>('/api/legal/reports', { params: new HttpParams().set('type', type) }); }
}
