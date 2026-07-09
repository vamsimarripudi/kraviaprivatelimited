import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogRecord, CompanyProfile } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getCompanyProfile(): Observable<CompanyProfile> { return this.http.get<CompanyProfile>('/api/company-profile'); }
  saveCompanyProfile(payload: CompanyProfile): Observable<CompanyProfile> { return this.http.put<CompanyProfile>('/api/company-profile', payload); }
  auditLogs(): Observable<AuditLogRecord[]> { return this.http.get<AuditLogRecord[]>('/api/audit-logs'); }
}
