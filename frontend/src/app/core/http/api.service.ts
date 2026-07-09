import { HttpClient, HttpEvent, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogRecord, CompanyProfile, DocumentCategory, DocumentMetadataRequest, DocumentRecord, DocumentStatus } from '../models/api.models';

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
}
