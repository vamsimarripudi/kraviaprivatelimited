import { HttpClient, HttpEvent, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogRecord, BoardMeetingRecord, BoardMeetingRequest, CompanyProfile, DocumentCategory, DocumentMetadataRequest, DocumentRecord, DocumentStatus, MeetingActionItemRecord, MeetingActionItemRequest, MeetingStatus, MeetingType } from '../models/api.models';

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
}
