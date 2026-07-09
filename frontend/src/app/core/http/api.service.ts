import { HttpClient, HttpEvent, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AnnouncementRecord, AnnouncementRequest, AuditLogRecord, BoardMeetingRecord, BoardMeetingRequest, CompanyProfile, CompanyTask, CompanyTaskRequest, ContactCategory, ContactRecord, ContactRequest, ContactStatus, ComplianceCategory, ComplianceItem, ComplianceItemRequest, CompliancePriority, ComplianceStatus, DocumentCategory, DocumentMetadataRequest, DocumentRecord, DocumentStatus, FinancialRecord, FinancialRecordRequest, MeetingActionItemRecord, MeetingActionItemRequest, MeetingStatus, MeetingType, NotificationRecord, ProductRecord, ProductRequest, ProductStatus, ReportFilters, ReportResponse, ReportType, SearchResponse, TaskCategory, TaskPriority, TaskStatus, TaskStatusRequest } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

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
}
