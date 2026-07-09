import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../core/http/api.service';
import { AuditLogRecord } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

@Component({
  selector: 'kravia-audit',
  standalone: true,
  imports: [EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './audit.component.html'
})
export class AuditComponent {
  private readonly api = inject(ApiService);
  readonly logs = signal<AuditLogRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.api.auditLogs().subscribe({
      next: (logs) => this.logs.set(logs),
      error: () => this.error.set('Unable to load audit logs.'),
      complete: () => this.loading.set(false)
    });
  }
}
