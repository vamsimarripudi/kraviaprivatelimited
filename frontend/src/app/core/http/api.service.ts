import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogRecord, CompanyProfile, DashboardSummary, DocumentRecord, SearchResult } from '../models/api.models';
import { Role, UserAccount } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  dashboard(): Observable<DashboardSummary> { return this.http.get<DashboardSummary>('/api/dashboard/summary'); }
  getCompanyProfile(): Observable<CompanyProfile> { return this.http.get<CompanyProfile>('/api/company-profile'); }
  saveCompanyProfile(payload: CompanyProfile): Observable<CompanyProfile> { return this.http.put<CompanyProfile>('/api/company-profile', payload); }
  documents(): Observable<DocumentRecord[]> { return this.http.get<DocumentRecord[]>('/api/documents'); }
  uploadDocument(payload: FormData): Observable<DocumentRecord> { return this.http.post<DocumentRecord>('/api/documents', payload); }
  auditLogs(): Observable<AuditLogRecord[]> { return this.http.get<AuditLogRecord[]>('/api/audit-logs'); }
  users(): Observable<UserAccount[]> { return this.http.get<UserAccount[]>('/api/users'); }
  createUser(payload: { email: string; displayName: string; role: Role; password: string }): Observable<UserAccount> { return this.http.post<UserAccount>('/api/users', payload); }
  disableUser(id: string): Observable<void> { return this.http.delete<void>(`/api/users/${id}`); }
  list<T>(path: string): Observable<T[]> { return this.http.get<T[]>(`/api/${path}`); }
  get<T>(path: string, id: string): Observable<T> { return this.http.get<T>(`/api/${path}/${id}`); }
  create<T>(path: string, payload: unknown): Observable<T> { return this.http.post<T>(`/api/${path}`, payload); }
  update<T>(path: string, id: string, payload: unknown): Observable<T> { return this.http.put<T>(`/api/${path}/${id}`, payload); }
  archive(path: string, id: string): Observable<void> { return this.http.delete<void>(`/api/${path}/${id}`); }
  search(q: string): Observable<SearchResult[]> { return this.http.get<SearchResult[]>('/api/search', { params: { q } }); }
}
